# FILE: public/modules/egenkontrol/rutiner.html

```html
﻿<!DOCTYPE html>
<html lang="da">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Daglige rutiner | Madkontrollen Pro</title>

    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">

    <link rel="stylesheet" href="/css/style.css">
    <link rel="stylesheet" href="/css/process-cards.css">

    <style>
        .task-item{
            display:grid;
            grid-template-columns:auto minmax(0, 1fr) 240px;
            gap:18px;
            align-items:start;
        }

        .task-action{
            min-width:240px;
        }

        .task-camera-btn{
            width:100%;
            margin-top:8px;
            border-color:#cfe0cf;
            background:#eef6ff;
            color:#1c3f6e;
            font-weight:800;
        }

        .task-guide-toggle{
            margin-top:12px;
            padding:0;
            border:none;
            background:none;
            color:var(--green);
            font-weight:800;
            font-size:14px;
            cursor:pointer;
            display:inline-flex;
            align-items:center;
            gap:8px;
        }

        .task-guide-toggle:hover{
            color:var(--green-dark);
        }

        .task-guide-toggle-text::before{
            content:"▸";
            display:inline-block;
            transition:transform 0.18s ease;
            margin-right:4px;
        }

        .task-guide-toggle[aria-expanded="true"] .task-guide-toggle-text::before{
            transform:rotate(90deg);
        }

        .task-guide{
            margin-top:0;
            padding:18px;
            border:1px solid var(--border);
            border-radius:16px;
            background:linear-gradient(180deg,#fbfdfb 0%, #f7faf7 100%);
        }

        .task-guide-panel-row{
            grid-column:2 / -1;
            margin-top:4px;
        }

        .task-guide[hidden]{
            display:none !important;
        }

        .task-guide-title{
            margin:0 0 10px;
            font-size:16px;
            font-weight:800;
            color:var(--text);
        }

        .task-guide-intro{
            margin:0 0 14px;
            color:var(--muted);
            line-height:1.6;
            font-size:14px;
        }

        .task-guide-grid{
            display:grid;
            grid-template-columns:repeat(2, minmax(0, 1fr));
            gap:14px;
        }

        .task-guide-box{
            padding:14px;
            border:1px solid var(--border);
            border-radius:14px;
            background:#fff;
        }

        .task-guide-box h5{
            margin:0 0 10px;
            font-size:14px;
            font-weight:800;
            color:var(--text);
        }

        .task-guide-box ul{
            margin:0;
            padding-left:18px;
            color:var(--text);
        }

        .task-guide-box li{
            margin:0 0 8px;
            line-height:1.55;
            font-size:14px;
        }

        .task-guide-box li:last-child{
            margin-bottom:0;
        }

        .task-guide-box.is-warning{
            background:#fffaf0;
            border-color:#f0dfb7;
        }

        .operating-status-wrap{
            margin-bottom:20px;
        }

        .operating-status-banner{
            display:flex;
            align-items:flex-start;
            justify-content:space-between;
            gap:18px;
            padding:18px 20px;
            border-radius:22px;
            border:1px solid #d9e4d9;
            background:linear-gradient(180deg,#ffffff 0%, #f7fbf7 100%);
            box-shadow:0 12px 30px rgba(19, 44, 21, 0.08);
        }

        .operating-status-banner[data-mode="open"]{
            border-color:#d9e9da;
            background:linear-gradient(180deg,#f8fff8 0%, #edf8ee 100%);
        }

        .operating-status-banner[data-mode="open"] .operating-status-title{
            color:#1f6e2a;
        }

        .operating-status-banner[data-mode="open"] .operating-status-text{
            color:#355a39;
        }

        .operating-status-banner[data-mode="closed"]{
            border-color:#e7bcbc;
            background:linear-gradient(180deg,#fff1f1 0%, #fbe3e3 100%);
        }

        .operating-status-banner[data-mode="closed"] .operating-status-title{
            color:#b42318;
        }

        .operating-status-banner[data-mode="closed"] .operating-status-text{
            color:#7a1f1f;
        }

        .operating-status-banner[data-mode="vacation"]{
            border-color:#f1dfba;
            background:linear-gradient(180deg,#fffaf1 0%, #fef4df 100%);
        }

        .operating-status-main{
            flex:1;
            min-width:0;
        }

        .operating-status-label{
            display:inline-flex;
            align-items:center;
            gap:8px;
            font-size:12px;
            font-weight:800;
            letter-spacing:.08em;
            text-transform:uppercase;
            color:#446046;
            margin-bottom:8px;
        }

        .operating-status-title{
            margin:0 0 6px;
            font-size:28px;
            line-height:1.1;
        }

        .operating-status-text{
            margin:0;
            color:#5f6f60;
            font-size:15px;
            line-height:1.6;
        }

        .operating-status-meta{
            margin-top:12px;
            display:flex;
            flex-wrap:wrap;
            gap:10px;
        }

        .operating-meta-pill{
            display:inline-flex;
            align-items:center;
            min-height:34px;
            padding:7px 12px;
            border-radius:999px;
            font-size:13px;
            font-weight:700;
            background:#ffffff;
            border:1px solid #dde7dd;
            color:#304230;
        }

        .operating-admin-box{
            width:min(320px, 100%);
            display:flex;
            flex-direction:column;
            gap:10px;
            padding:14px;
            border-radius:18px;
            background:rgba(255,255,255,.78);
            border:1px solid rgba(40,65,40,.08);
        }

        .operating-admin-title{
            margin:0;
            font-size:14px;
            font-weight:800;
            color:#253225;
        }

        .operating-admin-text{
            margin:0;
            font-size:13px;
            line-height:1.5;
            color:#607060;
        }

        .operating-admin-actions{
            display:grid;
            grid-template-columns:repeat(3, minmax(0, 1fr));
            gap:8px;
        }

        .operating-admin-actions .btn{
            min-height:42px;
            padding:10px 12px;
            font-size:13px;
            font-weight:800;
        }

        .routine-status-note{
            margin-top:16px;
            padding:14px 16px;
            border-radius:16px;
            background:#f8fbf8;
            border:1px solid #dde7dd;
            color:#425442;
            font-size:14px;
            line-height:1.6;
        }

        .routine-status-note.is-closed{
            background:#fff7f7;
            border-color:#f0d3d3;
            color:#7b3f3f;
        }

        .routine-status-note.is-vacation{
            background:#fffaf1;
            border-color:#f1dfba;
            color:#7a5b16;
        }

        .routine-admin-row{
            display:flex;
            justify-content:space-between;
            align-items:center;
            gap:12px;
            margin-bottom:18px;
            padding:14px 16px;
            border-radius:18px;
            background:#f8fbf8;
            border:1px solid #dde7dd;
        }

        .routine-admin-row strong{
            display:block;
            font-size:14px;
            margin-bottom:4px;
        }

        .routine-admin-row span{
            color:#647264;
            font-size:13px;
        }

        .risk-compliance-panel{
            margin-top:18px;
            padding:20px;
            border-radius:22px;
            border:1px solid #d8e5da;
            background:linear-gradient(180deg,#f9fcf9 0%, #f2f8f3 100%);
            box-shadow:0 12px 28px rgba(24, 48, 27, 0.06);
        }

        .risk-compliance-head{
            display:flex;
            justify-content:space-between;
            align-items:flex-start;
            gap:18px;
            margin-bottom:16px;
        }

        .risk-compliance-head h3{
            margin:0 0 6px;
            font-size:20px;
            color:#203124;
        }

        .risk-compliance-head p{
            margin:0;
            color:#526453;
            line-height:1.6;
            font-size:14px;
        }

        .risk-compliance-badge{
            display:inline-flex;
            align-items:center;
            justify-content:center;
            min-height:34px;
            padding:7px 12px;
            border-radius:999px;
            background:#ffffff;
            border:1px solid #d7e4d9;
            color:#2c5830;
            font-size:13px;
            font-weight:800;
            white-space:nowrap;
        }

        .risk-compliance-grid{
            display:grid;
            grid-template-columns:repeat(3, minmax(0, 1fr));
            gap:14px;
        }

        .risk-compliance-card{
            padding:16px;
            border-radius:18px;
            border:1px solid #d9e6db;
            background:#fff;
        }

        .risk-compliance-label{
            display:block;
            margin-bottom:8px;
            font-size:13px;
            font-weight:800;
            letter-spacing:.04em;
            text-transform:uppercase;
            color:#516453;
        }

        .risk-compliance-value{
            display:block;
            font-size:34px;
            font-weight:800;
            line-height:1;
            color:#203124;
        }

        .risk-compliance-sub{
            margin-top:8px;
            color:#596b5a;
            font-size:14px;
            line-height:1.55;
        }

        .risk-compliance-actions{
            display:flex;
            flex-wrap:wrap;
            gap:10px;
            margin-top:16px;
        }

        .risk-compliance-note{
            margin-top:14px;
            color:#4e5f50;
            font-size:14px;
            line-height:1.6;
        }

        .routine-admin-actions{
            display:flex;
            flex-wrap:wrap;
            gap:8px;
        }

        .empty-box.is-operating-override{
            border:1px solid #e7d3a6;
            background:#fffaf1;
            color:#695019;
        }

        .hidden-for-non-admin{
            display:none !important;
        }

        .stat-box.nav-link-card,
        .routine-summary-card.nav-link-card{
            position:relative;
            cursor:pointer;
            transition:transform .15s ease, box-shadow .15s ease, border-color .15s ease;
        }

        .stat-box.nav-link-card .stat-label,
        .routine-summary-card.nav-link-card .routine-summary-label{
            display:block;
            padding-right:72px;
        }

        .stat-box.nav-link-card::after,
        .routine-summary-card.nav-link-card::after{
            content:"↗ Åbn";
            position:absolute;
            top:8px;
            right:12px;
            font-size:12px;
            font-weight:800;
            color:#2e7d32;
            background:#eef8ee;
            border:1px solid #cfe5cf;
            border-radius:999px;
            padding:3px 8px;
            opacity:.9;
            transform:translateY(1px);
            transition:opacity .15s ease, transform .15s ease, background .15s ease;
            pointer-events:none;
        }

        .stat-box.nav-link-card:hover,
        .routine-summary-card.nav-link-card:hover{
            transform:translateY(-1px);
            box-shadow:0 8px 18px rgba(19,44,21,.08);
            border-color:#cddccd;
        }

        .stat-box.nav-link-card:hover::after,
        .routine-summary-card.nav-link-card:hover::after,
        .stat-box.nav-link-card:focus-visible::after,
        .routine-summary-card.nav-link-card:focus-visible::after{
            opacity:1;
            transform:translateY(0);
            background:#e6f5e7;
        }

        .stat-box.nav-link-card:focus-visible,
        .routine-summary-card.nav-link-card:focus-visible{
            outline:2px solid #2e7d32;
            outline-offset:2px;
        }

        body.mobile-override-active .task-save-btn,
        body.mobile-override-active .task-notused-btn,
        body.mobile-override-active .task-camera-btn,
        body.mobile-override-active .task-clean-btn,
        body.mobile-override-active .task-deviation-btn,
        body.mobile-override-active .task-action-note{
            display:none !important;
        }

        @media (max-width: 1100px){
            .task-item{
                grid-template-columns:auto minmax(0, 1fr);
            }

            .task-action{
                grid-column:1 / -1;
                min-width:100%;
            }
        }

        @media (max-width: 900px){
            .task-guide-grid{
                grid-template-columns:1fr;
            }
        }

        @media (max-width: 860px){
            .operating-status-banner{
                flex-direction:column;
            }

            .risk-compliance-head{
                flex-direction:column;
            }

            .risk-compliance-grid{
                grid-template-columns:1fr;
            }

            .operating-admin-box{
                width:100%;
            }

            .operating-status-title{
                font-size:24px;
            }

            .routine-admin-row{
                flex-direction:column;
                align-items:flex-start;
            }

            .routine-admin-actions{
                width:100%;
            }

            .routine-admin-actions .btn{
                flex:1 1 120px;
            }
        }

        @media (max-width: 700px){
            .task-item{
                grid-template-columns:1fr;
                gap:14px;
            }

            .task-guide-panel-row{
                grid-column:1 / -1;
            }
        }

        @media (max-width: 640px){
            .stat-box.nav-link-card::after,
            .routine-summary-card.nav-link-card::after{
                display:none;
            }

            .stat-box.nav-link-card .stat-label,
            .routine-summary-card.nav-link-card .routine-summary-label{
                padding-right:0;
            }

            body.mobile-override-active .routine-summary-strip{
                grid-template-columns:1fr;
            }

            body.mobile-override-active .task-item{
                grid-template-columns:1fr;
            }

            body.mobile-override-active .task-action{
                display:none !important;
            }

            .operating-status-banner{
                padding:16px;
                border-radius:18px;
            }

            .operating-status-title{
                font-size:22px;
            }

            .operating-status-text{
                font-size:14px;
            }

            .operating-admin-actions{
                grid-template-columns:1fr;
            }

            .operating-meta-pill{
                width:100%;
                justify-content:flex-start;
            }
        }
    </style>
</head>
<body data-page="rutiner">
    <div id="headerMount"></div>

    <main class="page-shell">
        <div class="container app-layout">
            <div id="sidebarMount"></div>

            <section class="page-content">
                <section class="hero">
                    <div class="operating-status-wrap">
                        <div id="operatingStatusBanner" class="operating-status-banner" data-mode="open">
                            <div class="operating-status-main">
                                <div class="operating-status-label">
                                    <span>●</span>
                                    Driftstatus
                                </div>

                                <h2 id="operatingStatusTitle" class="operating-status-title">Åben for drift</h2>
                                <p id="operatingStatusText" class="operating-status-text">
                                    Dagens rutiner og handlinger vises som normalt.
                                </p>

                                <div id="operatingStatusMeta" class="operating-status-meta">
                                    <span class="operating-meta-pill">Status: Normal drift</span>
                                </div>
                            </div>

                            <div id="operatingAdminBox" class="operating-admin-box hidden-for-non-admin">
                                <p class="operating-admin-title">Admin-kontrol</p>
                                <p class="operating-admin-text">
                                    Sæt lokationen til åben, lukket eller ferie. Når lukket eller ferie er aktiv,
                                    skjules normale medarbejderhandlinger, og siden viser ikke røde mangler for lukkede dage.
                                </p>

                                <div class="operating-admin-actions">
                                    <button id="setOpenBtn" class="btn btn-secondary" type="button">Åben</button>
                                    <button id="setClosedBtn" class="btn btn-secondary" type="button">Lukket</button>
                                    <button id="setVacationBtn" class="btn btn-secondary" type="button">Ferie</button>
                                    <button id="setDateBtn" class="btn btn-secondary" type="button">Ret Dato</button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="hero-saas">
                        <div class="hero-saas-content">
                            <div class="eyebrow">Egenkontrol • Daglige rutiner • Registrering</div>
                            <h1 class="hero-title">Daglige rutiner</h1>
                            <p class="hero-text">
                                Her registrerer medarbejdere temperaturer, rengøring, datokontrol og andre daglige
                                rutiner. Fuldførte rutiner fjernes fra listen, mens afvigelser og andre handlinger
                                sendes videre til opfølgning.
                            </p>

                            <div class="hero-meta-row">
                                <span class="hero-meta-pill">Dato: <strong id="todayLabel">-</strong></span>
                                <span class="hero-meta-pill">Lokation: <strong id="locationLabel">-</strong></span>
                                <span class="hero-meta-pill">Status: <strong id="heroStatusLabel">Driftsoverblik</strong></span>
                            </div>

                            <div class="hero-chip-row">
                                <span class="chip is-live" id="heroLiveChip">Live data</span>
                                <span class="chip">Dagens rutiner</span>
                                <span class="chip">Temperatur</span>
                                <span class="chip">Rengøring</span>
                                <span class="chip">Afvigelser</span>
                            </div>

                            <div id="routineStatusNote" class="routine-status-note">
                                Visningen er klar til dagens registreringer.
                            </div>

                            <div class="hero-actions" style="margin-top: 20px; display: flex; gap: 12px;">
                                <a href="/modules/egenkontrol/luk-dag.html" class="btn btn-primary" style="display: inline-flex; align-items: center; gap: 8px; text-decoration: none; padding: 12px 20px; background: #dc2626; border-radius: 8px; color: #fff; font-weight: 700; font-size: 14px;">
                                    🔒 Luk dag og generér rapport
                                </a>
                                <a href="/modules/egenkontrol/rapporter.html" class="btn btn-secondary" style="display: inline-flex; align-items: center; gap: 8px; text-decoration: none; padding: 12px 20px; background: #f3f4f6; border-radius: 8px; color: #374151; font-weight: 600; font-size: 14px;">
                                    📄 Se tidligere rapporter
                                </a>
                            </div>
                        </div>

                        <div class="hero-saas-side">
                            <div class="stats-card">
                                <div class="stats-card-head">
                                    <h3>Overblik</h3>
                                    <span id="statsLiveBadge" class="status-live">Live</span>
                                </div>

                                <div class="stats-grid">
                                    <div class="stat-box nav-link-card" data-nav-action="tasks" role="button" tabindex="0">
                                        <span class="stat-label">Rutiner tilbage</span>
                                        <strong id="kpiTasks">0</strong>
                                    </div>

                                    <div class="stat-box nav-link-card" data-nav-action="completed" role="button" tabindex="0">
                                        <span class="stat-label">Fuldført i dag</span>
                                        <strong id="kpiCompleted">0</strong>
                                    </div>

                                    <div class="stat-box nav-link-card" data-nav-action="handled" role="button" tabindex="0">
                                        <span class="stat-label">Handlinger i dag</span>
                                        <strong id="kpiHandled">0</strong>
                                    </div>

                                    <div class="stat-box nav-link-card" data-nav-action="alerts" role="button" tabindex="0">
                                        <span class="stat-label">Åbne afvigelser</span>
                                        <strong id="kpiAlerts">0</strong>
                                    </div>
                                </div>

                                <div class="small-muted">
                                    Data hentes fra Firestore og opdateres ved indlæsning af siden.
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section class="section">
                    <div id="routineAdminRow" class="routine-admin-row hidden-for-non-admin">
                        <div>
                            <strong>Driftstatus for denne lokation</strong>
                            <span id="routineAdminRowText">Normal drift er aktiv.</span>
                        </div>

                        <div class="routine-admin-actions">
                            <button id="setOpenBtnInline" class="btn btn-secondary" type="button">Åben</button>
                            <button id="setClosedBtnInline" class="btn btn-secondary" type="button">Lukket</button>
                            <button id="setVacationBtnInline" class="btn btn-secondary" type="button">Ferie</button>
                            <button id="setDateBtnInline" class="btn btn-secondary" type="button">Ret Dato</button>
                        </div>
                    </div>

                    <div class="routine-summary-strip">
                        <div class="routine-summary-card nav-link-card" data-nav-action="tasks" role="button" tabindex="0">
                            <span class="routine-summary-label">Aktive rutiner</span>
                            <div class="routine-summary-value" id="summaryActive">0</div>
                            <div class="routine-summary-sub">Det der mangler at blive håndteret i dag</div>
                        </div>

                        <div class="routine-summary-card nav-link-card" data-nav-action="completed" role="button" tabindex="0">
                            <span class="routine-summary-label">Fuldført</span>
                            <div class="routine-summary-value" id="summaryCompleted">0</div>
                            <div class="routine-summary-sub">Registreret som ok i dag</div>
                        </div>

                        <div class="routine-summary-card nav-link-card" data-nav-action="handled" role="button" tabindex="0">
                            <span class="routine-summary-label">Kræver handling</span>
                            <div class="routine-summary-value" id="summaryHandled">0</div>
                            <div class="routine-summary-sub">Ikke i brug, rengøring eller afvigelse</div>
                        </div>

                        <div class="routine-summary-card nav-link-card" data-nav-action="alerts" role="button" tabindex="0">
                            <span class="routine-summary-label">Åbne afvigelser</span>
                            <div class="routine-summary-value" id="summaryAlerts">0</div>
                            <div class="routine-summary-sub">Åbne registreringer for denne lokation i dag</div>
                        </div>
                    </div>

                    <!-- Active Process Instances Section -->
                    <section id="active-processes-section" style="display: none; margin-bottom: 24px;">
                        <h2>🔥 Aktive processer</h2>
                        <div id="active-processes-list"></div>
                    </section>

                    <!-- Start Process Actions -->
                    <section id="process-actions" style="margin-bottom: 24px;">
                        <button id="btn-start-cooling" type="button">
                            🧊 Start nedkøling
                        </button>
                    </section>

                    <div class="risk-compliance-panel">
                        <div class="risk-compliance-head">
                            <div>
                                <h3>Daglig dokumentation fra risikoanalyse</h3>
                                <p>
                                    Dagens drift skal kunne dokumentere aktive logbøger, udførte registreringer,
                                    korrigerende handlinger ved afvigelser og en tilgængelig rengøringsplan.
                                </p>
                            </div>

                            <div id="riskComplianceBadge" class="risk-compliance-badge">Driftskrav aktive</div>
                        </div>

                        <div class="risk-compliance-grid">
                            <div class="risk-compliance-card">
                                <span class="risk-compliance-label">Aktive logbøger</span>
                                <strong id="riskLinkedCount" class="risk-compliance-value">0</strong>
                                <div id="riskLinkedSub" class="risk-compliance-sub">Ingen aktive kontroller fundet endnu.</div>
                            </div>

                            <div class="risk-compliance-card">
                                <span class="risk-compliance-label">Afvigelser med handling</span>
                                <strong id="deviationActionCount" class="risk-compliance-value">0</strong>
                                <div id="deviationActionSub" class="risk-compliance-sub">Ingen åbne sager kræver handling lige nu.</div>
                            </div>

                            <div class="risk-compliance-card">
                                <span class="risk-compliance-label">Rengøringsplan i drift</span>
                                <strong id="cleaningPlanCount" class="risk-compliance-value">0</strong>
                                <div id="cleaningPlanSub" class="risk-compliance-sub">Ingen rengøringspunkter er genereret for dagen.</div>
                            </div>
                        </div>

                        <div class="risk-compliance-actions">
                            <a class="btn btn-secondary" href="/modules/egenkontrol/logbooks.html">Åbn logbøger</a>
                            <a class="btn btn-secondary" href="/modules/egenkontrol/rapporter.html?view=today">Åbn rapporter</a>
                            <a class="btn btn-secondary" href="/modules/egenkontrol/afvigelser.html?filter=open">Åbn afvigelser</a>
                            <a class="btn btn-secondary" href="/modules/egenkontrol/risikoanalyse.html">Åbn risikoanalyse</a>
                        </div>

                        <div id="riskComplianceNote" class="risk-compliance-note">
                            Dagens registreringer gemmes i rapporten og skal ledsage risikoanalysen ved kontrol.
                        </div>
                    </div>

                    <div class="section-header">
                        <div>
                            <h2>Dagens opgaver</h2>
                            <p>Fuldfør rutinen direkte, eller send den videre til korrigerende handling.</p>
                        </div>

                        <div class="section-tools">
                            <span class="count-badge" id="visibleTaskBadge">0</span>
                        </div>
                    </div>

                    <div id="taskList" class="task-list">
                        <div class="loading-box">Henter dagens rutiner...</div>
                    </div>
                </section>
            </section>
        </div>
    </main>

    <script type="module">
        import { setupAuthGate } from "/core/auth.js";
        import { loadLayout } from "/core/layout.js";
        import app, { db } from "/core/firebase-config.js";
        import { 
            isImpersonating, 
            getEffectiveCompanyId, 
            getEffectiveLocationId,
            renderImpersonationBanner 
        } from "/core/impersonation.js";
        import {
            collection,
            getDocs,
            getDoc,
            addDoc,
            doc,
            setDoc,
            updateDoc,
            arrayUnion,
            serverTimestamp,
            query,
            where,
            limit
        } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
        import {
            getFunctions,
            httpsCallable,
            httpsCallableFromURL
        } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";

        const SETTINGS = {
            companyId: "",
            companyLegacyId: "",
            unitId: "",
            locationId: "",
            locationLegacyId: "",
            createdBy: "",
            employeeName: "",
            currentUserName: "",
            currentUserRole: "employee",
            currentUserLocations: [],
            currentUserCompanyId: ""
        };

        const PROFILE_KEY = "mkp_egenkontrol_company_profile_v1";
        const TASK_TEMPLATE_KEY = "mkp_egenkontrol_task_templates_v1";

        await loadLayout();

        const functionsClient = getFunctions(app, "us-central1");
        const saveRoutineTaskCallable = httpsCallable(functionsClient, "saveRoutineTask");
        const getCloudinarySignatureCallable = httpsCallable(functionsClient, "getCloudinarySignature");
        const analyzeCloudinaryAssetCallable = httpsCallable(functionsClient, "analyzeCloudinaryAsset");

        const taskListEl = document.getElementById("taskList");
        const kpiTasksEl = document.getElementById("kpiTasks");
        const kpiCompletedEl = document.getElementById("kpiCompleted");
        const kpiHandledEl = document.getElementById("kpiHandled");
        const kpiAlertsEl = document.getElementById("kpiAlerts");
        const locationLabelEl = document.getElementById("locationLabel");
        const todayLabelEl = document.getElementById("todayLabel");
        const visibleTaskBadgeEl = document.getElementById("visibleTaskBadge");

        const summaryActiveEl = document.getElementById("summaryActive");
        const summaryCompletedEl = document.getElementById("summaryCompleted");
        const summaryHandledEl = document.getElementById("summaryHandled");
        const summaryAlertsEl = document.getElementById("summaryAlerts");

        const heroStatusLabelEl = document.getElementById("heroStatusLabel");
        const heroLiveChipEl = document.getElementById("heroLiveChip");
        const statsLiveBadgeEl = document.getElementById("statsLiveBadge");
        const routineStatusNoteEl = document.getElementById("routineStatusNote");

        const operatingStatusBannerEl = document.getElementById("operatingStatusBanner");
        const operatingStatusTitleEl = document.getElementById("operatingStatusTitle");
        const operatingStatusTextEl = document.getElementById("operatingStatusText");
        const operatingStatusMetaEl = document.getElementById("operatingStatusMeta");
        const operatingAdminBoxEl = document.getElementById("operatingAdminBox");
        const routineAdminRowEl = document.getElementById("routineAdminRow");
        const routineAdminRowTextEl = document.getElementById("routineAdminRowText");
        const riskLinkedCountEl = document.getElementById("riskLinkedCount");
        const riskLinkedSubEl = document.getElementById("riskLinkedSub");
        const deviationActionCountEl = document.getElementById("deviationActionCount");
        const deviationActionSubEl = document.getElementById("deviationActionSub");
        const cleaningPlanCountEl = document.getElementById("cleaningPlanCount");
        const cleaningPlanSubEl = document.getElementById("cleaningPlanSub");
        const riskComplianceBadgeEl = document.getElementById("riskComplianceBadge");
        const riskComplianceNoteEl = document.getElementById("riskComplianceNote");

        const setOpenBtn = document.getElementById("setOpenBtn");
        const setClosedBtn = document.getElementById("setClosedBtn");
        const setVacationBtn = document.getElementById("setVacationBtn");

        const setOpenBtnInline = document.getElementById("setOpenBtnInline");
        const setClosedBtnInline = document.getElementById("setClosedBtnInline");
        const setVacationBtnInline = document.getElementById("setVacationBtnInline");
        const setDateBtn = document.getElementById("setDateBtn");
        const setDateBtnInline = document.getElementById("setDateBtnInline");

        let allTasks = [];
        let alertCount = 0;
        const processingTaskIds = new Set();
        const aiSuggestionsByInstance = new Map();
        let operatingButtonsBound = false;
        let selectedDateKey = null;

        let operatingOverride = null;
        let operatingState = {
            isOpen: true,
            isClosed: false,
            isVacation: false,
            reason: "",
            untilDateKey: null,
            statusText: "Normal drift"
        };

        function getDanishDateFormatter() {
            return new Intl.DateTimeFormat("da-DK", {
                timeZone: "Europe/Copenhagen",
                weekday: "long",
                day: "2-digit",
                month: "long",
                year: "numeric"
            });
        }

        function getDateKeyFormatter() {
            return new Intl.DateTimeFormat("sv-SE", {
                timeZone: "Europe/Copenhagen",
                year: "numeric",
                month: "2-digit",
                day: "2-digit"
            });
        }

        function formatDateLabel(date) {
            return getDanishDateFormatter().format(date);
        }

        function formatDateTimeDa(value) {
            const parsed = parseDateValue(value);
            if (!parsed) return "-";

            return new Intl.DateTimeFormat("da-DK", {
                timeZone: "Europe/Copenhagen",
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit"
            }).format(parsed);
        }

        function getTaskCreatedAt(task) {
            return (
                task?.createdAt ||
                task?.generatedAt ||
                task?.created_at ||
                null
            );
        }

        function getTaskHandledAt(task) {
            return (
                task?.completedAt ||
                task?.resolvedAt ||
                task?.closedAt ||
                task?.handledAt ||
                null
            );
        }

        function getTodayKey() {
            if (selectedDateKey) {
                return selectedDateKey;
            }
            return getDateKeyFormatter().format(new Date());
        }

        function getDateKey(date = new Date()) {
            return getDateKeyFormatter().format(date);
        }

        function getDisplayedDate() {
            if (!selectedDateKey) {
                return new Date();
            }

            const [year, month, day] = selectedDateKey.split("-").map(Number);
            return new Date(year, (month || 1) - 1, day || 1);
        }

        function updateTodayLabel() {
            if (!todayLabelEl) return;
            todayLabelEl.textContent = formatDateLabel(getDisplayedDate());
        }

        updateTodayLabel();

        function safeJsonParse(value) {
            try {
                return value ? JSON.parse(value) : null;
            } catch (error) {
                console.warn("Kunne ikke læse JSON:", error);
                return null;
            }
        }

        function getProfile() {
            return safeJsonParse(localStorage.getItem(PROFILE_KEY));
        }

        function getTaskTemplates() {
            const parsed = safeJsonParse(localStorage.getItem(TASK_TEMPLATE_KEY));
            return Array.isArray(parsed) ? parsed : [];
        }

        function setLocationLabel() {
            const profile = getProfile();

            if (!locationLabelEl) return;

            locationLabelEl.textContent =
                profile?.companyName ||
                profile?.companyType ||
                SETTINGS.locationId;
        }

        setLocationLabel();

        function parseDateValue(value) {
            if (!value) return null;

            if (typeof value === "string") {
                const parsed = new Date(value);
                return Number.isNaN(parsed.getTime()) ? null : parsed;
            }

            if (value instanceof Date) {
                return Number.isNaN(value.getTime()) ? null : value;
            }

            if (typeof value.toDate === "function") {
                const parsed = value.toDate();
                return Number.isNaN(parsed.getTime()) ? null : parsed;
            }

            return null;
        }

        function normalizeDateKey(value) {
            if (!value) return null;

            if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
                return value.trim();
            }

            const parsed = parseDateValue(value);
            return parsed ? getDateKey(parsed) : null;
        }

        function escapeHtml(value) {
            return String(value ?? "")
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        }

        function escapeAttribute(value) {
            return escapeHtml(value).replace(/`/g, "&#096;");
        }

        function slugify(value) {
            return String(value ?? "")
                .toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-+|-+$/g, "");
        }

        function toLegacyId(value = "") {
            return String(value || "").replace(/_/g, "-");
        }

        function normalizeLocationIds(value) {
            const values = [];

            const pushValue = (item) => {
                const normalized = String(item || "").trim();
                if (normalized) values.push(normalized);
            };

            if (Array.isArray(value)) {
                value.forEach(pushValue);
            } else if (value && typeof value === "object") {
                if (Array.isArray(value.locationIds)) {
                    value.locationIds.forEach(pushValue);
                }
                pushValue(value.primaryLocationId);
                pushValue(value.locationId);
            } else {
                pushValue(value);
            }

            return [...new Set(values)];
        }

        function getProfileCompanyId(profile) {
            return String(profile?.companyId || profile?.organizationId || "").trim();
        }

        function getStoredLocationId() {
            try {
                return String(sessionStorage.getItem("mkp_selected_locationId") || "").trim();
            } catch {
                return "";
            }
        }

        function setStoredLocationId(locationId) {
            try {
                const normalized = String(locationId || "").trim();
                if (normalized) {
                    sessionStorage.setItem("mkp_selected_locationId", normalized);
                }
            } catch {
                // Ignore storage issues in private mode.
            }
        }

        function userIsResponsible() {
            const isAdmin = String(SETTINGS.currentUserRole || "").trim().toLowerCase() === "admin";
            if (!isAdmin) return false;

            const companyScope = String(SETTINGS.currentUserCompanyId || "").trim();
            if (companyScope && ![SETTINGS.companyId, SETTINGS.companyLegacyId].includes(companyScope)) {
                return false;
            }

            const allowedLocations = Array.isArray(SETTINGS.currentUserLocations)
                ? SETTINGS.currentUserLocations.map((item) => String(item || "").trim()).filter(Boolean)
                : [];

            // Backward compatible: if locationIds are not set yet, keep existing admin behavior.
            if (!allowedLocations.length) return true;

            return [SETTINGS.locationId, SETTINGS.locationLegacyId].some((id) => allowedLocations.includes(id));
        }

        async function setReferenceDateFromPrompt() {
            if (!userIsResponsible()) {
                alert("Kun admin må ændre visningsdato.");
                return;
            }

            const currentSuggestion = selectedDateKey || getDateKey(new Date());
            const raw = window.prompt(
                "Ret dato (YYYY-MM-DD). Slet indhold og tryk OK for at gå tilbage til dags dato.",
                currentSuggestion
            );

            if (raw === null) return;

            const trimmed = raw.trim();

            if (!trimmed) {
                selectedDateKey = null;
            } else {
                const normalized = normalizeDateKey(trimmed);
                if (!normalized) {
                    alert("Ugyldig dato. Brug formatet YYYY-MM-DD.");
                    return;
                }
                selectedDateKey = normalized;
            }

            updateTodayLabel();
            await loadPageData();
        }

        function getOverrideDocId() {
            return `${SETTINGS.companyId}__${SETTINGS.locationId}`;
        }

        function createInstanceIdFromTemplate(templateId, dateKey, index = 0) {
            const suffix = index > 0 ? `-${index}` : "";
            return `${slugify(templateId)}__${dateKey}${suffix}`;
        }

        function isTaskVisible(task) {
            if (task?.registrationDeferred === true) {
                return false;
            }

            if (task?.requiresRegistration === false) {
                return false;
            }

            return task.status === "pending" || task.status === "open" || task.status === "overdue" || !task.status;
        }

        function getVisibleTasks() {
            return allTasks.filter(isTaskVisible);
        }

        function getHandledCount() {
            return allTasks.filter((task) =>
                task.status === "failed" ||
                task.status === "not_in_use" ||
                task.status === "cleaning_required"
            ).length;
        }

        function getRiskLinkedTasks() {
            return allTasks.filter((task) => Array.isArray(task.linkedRiskIds) && task.linkedRiskIds.length);
        }

        function getCleaningTasks() {
            return allTasks.filter((task) => {
                const category = String(task.category || task.type || "").toLowerCase();
                const searchable = [
                    task.title,
                    task.description,
                    task.controlPoint,
                    task.equipmentType,
                    category
                ].join(" ").toLowerCase();

                return category.includes("clean") || searchable.includes("rengør") || searchable.includes("rengor");
            });
        }

        function updateRiskCompliancePanel() {
            if (!riskLinkedCountEl || !deviationActionCountEl || !cleaningPlanCountEl) return;

            const riskLinkedTasks = getRiskLinkedTasks();
            const cleaningTasks = getCleaningTasks();
            const openDeviationCount = operatingState.isClosed || operatingState.isVacation ? 0 : alertCount;
            const riskLinkedCompleted = riskLinkedTasks.filter((task) => task.status === "completed").length;

            riskLinkedCountEl.textContent = String(riskLinkedTasks.length);
            riskLinkedSubEl.textContent = riskLinkedTasks.length
                ? `${riskLinkedCompleted} af ${riskLinkedTasks.length} risikostyrede kontroller er allerede dokumenteret i dag.`
                : "Ingen risikostyrede dagskontroller er fundet. Gennemgå risikoanalyse og onboarding.";

            deviationActionCountEl.textContent = String(openDeviationCount);
            deviationActionSubEl.textContent = openDeviationCount
                ? `${openDeviationCount} åbne afvigelser kræver dokumenteret korrigerende handling.`
                : "Ingen åbne afvigelser kræver handling lige nu.";

            cleaningPlanCountEl.textContent = String(cleaningTasks.length);
            cleaningPlanSubEl.textContent = cleaningTasks.length
                ? `${cleaningTasks.length} rengøringspunkter er en del af dagens plan og skal kunne dokumenteres.`
                : "Ingen rengøringspunkter er genereret. Kontroller onboarding og faste rengøringsopgaver.";

            if (riskComplianceBadgeEl) {
                if (!riskLinkedTasks.length || !cleaningTasks.length) {
                    riskComplianceBadgeEl.textContent = "Driftskrav skal gennemgås";
                } else if (openDeviationCount > 0) {
                    riskComplianceBadgeEl.textContent = "Afvigelser kræver handling";
                } else {
                    riskComplianceBadgeEl.textContent = "Dokumentation på plads";
                }
            }

            if (riskComplianceNoteEl) {
                if (!riskLinkedTasks.length) {
                    riskComplianceNoteEl.textContent = "Risikoanalysen skal ledsages af aktive logbøger. Der er ikke fundet daglige risikostyrede kontroller på denne lokation endnu.";
                } else if (!cleaningTasks.length) {
                    riskComplianceNoteEl.textContent = "Fast rengøringsplan skal være tilgængelig i driften. Der er ikke fundet rengøringspunkter i dagens rutiner.";
                } else if (openDeviationCount > 0) {
                    riskComplianceNoteEl.textContent = "Hvis en måling eller kontrol fejler, skal afvigelsen lukkes med dokumenteret korrigerende handling. Brug afvigelsessiden til at afslutte sagerne korrekt.";
                } else {
                    riskComplianceNoteEl.textContent = "Dagens registreringer gemmes i rapporten og ledsager risikoanalysen, logbøgerne og rengøringsplanen ved kontrolbesøg.";
                }
            }
        }

        function updateKpis() {
            const overrideActive = operatingState.isClosed || operatingState.isVacation;
            const visibleTasks = overrideActive ? [] : getVisibleTasks();
            const completed = allTasks.filter((task) => task.status === "completed").length;
            const handled = overrideActive ? 0 : getHandledCount();
            const shownAlerts = overrideActive ? 0 : alertCount;

            kpiTasksEl.textContent = String(visibleTasks.length);
            kpiCompletedEl.textContent = String(completed);
            kpiHandledEl.textContent = String(handled);
            kpiAlertsEl.textContent = String(shownAlerts);

            summaryActiveEl.textContent = String(visibleTasks.length);
            summaryCompletedEl.textContent = String(completed);
            summaryHandledEl.textContent = String(handled);
            summaryAlertsEl.textContent = String(shownAlerts);

            if (visibleTaskBadgeEl) {
                visibleTaskBadgeEl.textContent = String(visibleTasks.length);
            }

            updateRiskCompliancePanel();
        }

        function bindOverviewNavigation() {
            const cards = document.querySelectorAll(".nav-link-card[data-nav-action]");
            if (!cards.length) return;

            const handleNavigation = (action) => {
                if (action === "tasks") {
                    taskListEl?.scrollIntoView({ behavior: "smooth", block: "start" });
                    return;
                }

                if (action === "completed") {
                    window.location.href = "/modules/egenkontrol/rapporter.html?view=today";
                    return;
                }

                if (action === "handled") {
                    window.location.href = "/modules/egenkontrol/afvigelser.html?filter=all";
                    return;
                }

                if (action === "alerts") {
                    window.location.href = "/modules/egenkontrol/afvigelser.html?filter=open";
                }
            };

            cards.forEach((card) => {
                const action = card.getAttribute("data-nav-action") || "";
                card.addEventListener("click", () => handleNavigation(action));
                card.addEventListener("keydown", (event) => {
                    if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        handleNavigation(action);
                    }
                });
            });
        }

        function getTaskType(task) {
            if (
                task.type === "temperature_check" ||
                task.type === "process_temperature_check" ||
                task.requiresMeasurement === true
            ) {
                return "measurement";
            }
            return "check";
        }

        function getTaskPlaceholder(task) {
            const unit = getUnit(task);
            return unit === "C" || unit === "°C" ? "Fx 4" : "Indtast måling";
        }

        function getUnit(task) {
            return task.measurementUnit || "";
        }

        function getEquipmentName(task) {
            return task.equipmentName || "";
        }

        function getVisibleTitle(task) {
            const title = task.title || "Rutine";
            const equipmentName = getEquipmentName(task);

            if (equipmentName && !String(title).includes(equipmentName)) {
                return `${title} – ${equipmentName}`;
            }

            return title;
        }

        function getVisibleStatus(status) {
            if (status === "completed") return "Fuldført";
            if (status === "failed") return "Afvigelse";
            if (status === "overdue") return "Gået over tid";
            if (status === "not_in_use") return "Ikke i brug";
            if (status === "cleaning_required") return "Mangler rengøring";
            if (status === "pending" || status === "open") return "Afventer";
            return status || "Afventer";
        }

        function getStatusPillClass(status) {
            if (status === "completed") return "is-completed";
            if (status === "overdue") return "is-danger";
            if (status === "failed") return "is-danger";
            if (status === "not_in_use" || status === "cleaning_required") return "is-warning";
            return "is-pending";
        }

        function getTaskDeadline(task) {
            if (!task?.deadlineAt) return null;
            const parsed = new Date(task.deadlineAt);
            return Number.isNaN(parsed.getTime()) ? null : parsed;
        }

        function isTaskOverdue(task) {
            if (!task) return false;
            if (task.status === "completed" || task.status === "not_in_use") return false;
            const deadline = getTaskDeadline(task);
            if (!deadline) return false;
            return new Date() > deadline;
        }

        function formatDeadlineLabel(task) {
            const deadline = getTaskDeadline(task);
            if (!deadline) return "";

            return new Intl.DateTimeFormat("da-DK", {
                dateStyle: "short",
                timeStyle: "short"
            }).format(deadline);
        }

        function renderEmptyState(message = "Der er ikke flere aktive opgaver tilbage for i dag på denne lokation.", isOverride = false) {
            taskListEl.innerHTML = `
                <div class="empty-box ${isOverride ? "is-operating-override" : ""}">
                    <h3>${isOverride ? "Rutiner er sat på pause" : "Alle dagens rutiner er håndteret"}</h3>
                    <p>${escapeHtml(message)}</p>
                </div>
            `;
        }

        function shouldShowGuide(task) {
            return Boolean(task && task.id);
        }

        function normalizeGuideList(items) {
            if (!Array.isArray(items)) return [];
            return items
                .map((item) => String(item ?? "").trim())
                .filter(Boolean);
        }

        function getSpecializedGuide(task) {
            // STRICTLY guideKey-driven - NO fallbacks
            if (!task.guideKey) {
                console.error("❌ Task missing guideKey", {
                    title: task.title || task.taskTitle || null,
                    taskId: task.id || task.taskInstanceId || null,
                    templateId: task.templateId || null
                });
                return null;
            }
            
            let guide = null;
            
            // Try V2 guide library first
            if (window.getGuideByKeyV2) {
                guide = window.getGuideByKeyV2(task.guideKey);
                if (guide) {
                    console.log("✅ Guide resolved", {
                        guideKey: task.guideKey,
                        guideTitle: guide.title,
                        source: "v2-guideKey"
                    });
                    return {
                        title: guide.title,
                        intro: null,
                        areas: [],
                        steps: guide.steps || [],
                        approval: [],
                        ifNotOk: []
                    };
                }
            }

            // Try standard guide library
            if (window.getGuideForTask) {
                guide = window.getGuideForTask(task);
                if (guide) {
                    console.log("✅ Guide resolved", {
                        guideKey: task.guideKey,
                        guideTitle: guide.title,
                        source: "getGuideForTask"
                    });
                    return {
                        title: guide.title,
                        intro: guide.intro,
                        areas: guide.areas || [],
                        steps: guide.steps || [],
                        approval: guide.approval || [],
                        ifNotOk: guide.ifNotOk || []
                    };
                }
            }
            
            // Guide not found for valid guideKey
            console.error("❌ Guide not found for guideKey", {
                guideKey: task.guideKey,
                title: task.title || task.taskTitle || null
            });
            return null;
        }

        function getGuideData(task) {
            const specialized = getSpecializedGuide(task);

            if (specialized) {
                return specialized;
            }

            // No valid guide found - return minimal placeholder
            return {
                title: "Guide mangler",
                intro: "Denne opgave mangler en gyldig guide. Kontakt administrator.",
                areas: [],
                steps: [
                    "Kontakt administrator for at få tilføjet en korrekt guide til denne opgave."
                ],
                approval: [],
                ifNotOk: []
            };
        }

        function renderGuideList(title, items, extraClass = "") {
            if (!items.length) return "";

            return `
                <div class="task-guide-box ${extraClass}">
                    <h5>${escapeHtml(title)}</h5>
                    <ul>
                        ${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
                    </ul>
                </div>
            `;
        }

        function renderGuideToggle(task) {
            if (!shouldShowGuide(task)) {
                return "";
            }

            const guideId = `guide-${task.id}`;

            return `
                <button
                    type="button"
                    class="task-guide-toggle"
                    data-guide-toggle="${escapeAttribute(task.id)}"
                    aria-expanded="false"
                    aria-controls="${escapeAttribute(guideId)}"
                    title="Kokkens Guide - Klik for faglig vejledning"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="16" x2="12" y2="12"></line>
                        <line x1="12" y1="8" x2="12.01" y2="8"></line>
                    </svg>
                    <span class="task-guide-toggle-text">Kokkens Guide</span>
                </button>
            `;
        }

        function renderGuidePanel(task) {
            if (!shouldShowGuide(task)) {
                return "";
            }

            const guideId = `guide-${task.id}`;
            const guide = getGuideData(task);

            return `
                <div class="task-guide-panel-row">
                    <div
                        id="${escapeAttribute(guideId)}"
                        class="task-guide"
                        data-guide-panel="${escapeAttribute(task.id)}"
                        hidden
                    >
                        <h5 class="task-guide-title">${escapeHtml(guide.title)}</h5>
                        ${
                            guide.intro
                                ? `<p class="task-guide-intro">${escapeHtml(guide.intro)}</p>`
                                : ""
                        }

                        <div class="task-guide-grid">
                            ${renderGuideList("Hvad skal kontrolleres", guide.areas)}
                            ${renderGuideList("Sådan gør du", guide.steps)}
                            ${renderGuideList("Hvornår er det godkendt", guide.approval)}
                            ${renderGuideList("Hvis det ikke er ok", guide.ifNotOk, "is-warning")}
                        </div>
                    </div>
                </div>
            `;
        }

        function applyOperatingStateToUi() {
            const responsible = userIsResponsible();
            const mobileOverrideActive = operatingState.isClosed || operatingState.isVacation;

            document.body.classList.toggle("mobile-override-active", mobileOverrideActive);

            operatingAdminBoxEl.classList.toggle("hidden-for-non-admin", !responsible);
            routineAdminRowEl.classList.toggle("hidden-for-non-admin", !responsible);

            if (operatingState.isClosed) {
                operatingStatusBannerEl.dataset.mode = "closed";
                operatingStatusTitleEl.textContent = "Lokationen er lukket";
                operatingStatusTextEl.textContent =
                    "Dagens normale rutiner er sat på pause. Medarbejdere skal ikke mødes af fejl, mangler eller røde statusmarkeringer på lukkede dage.";
                heroStatusLabelEl.textContent = "Lukket";
                heroLiveChipEl.textContent = "Lukket";
                statsLiveBadgeEl.textContent = "Lukket";
                routineStatusNoteEl.className = "routine-status-note is-closed";
                routineStatusNoteEl.innerHTML = "Lokationen er markeret som <strong>lukket</strong>. Der vises ingen røde mangler, og normale medarbejderhandlinger er skjult for denne dag.";
                routineAdminRowTextEl.textContent = "Lukket mode er aktiv for denne lokation.";
            } else if (operatingState.isVacation) {
                operatingStatusBannerEl.dataset.mode = "vacation";
                operatingStatusTitleEl.textContent = "Lokationen er i ferie-mode";
                operatingStatusTextEl.textContent =
                    "Dagens normale rutiner er sat på pause, så medarbejdere ikke bliver forvirrede på ferie- og pausedage.";
                heroStatusLabelEl.textContent = "Ferie";
                heroLiveChipEl.textContent = "Ferie";
                statsLiveBadgeEl.textContent = "Ferie";
                routineStatusNoteEl.className = "routine-status-note is-vacation";
                routineStatusNoteEl.innerHTML = "Lokationen er sat i <strong>ferie-mode</strong>. Dagens normale handlinger og mangler skjules for medarbejdere.";
                routineAdminRowTextEl.textContent = "Ferie mode er aktiv for denne lokation.";
            } else {
                operatingStatusBannerEl.dataset.mode = "open";
                operatingStatusTitleEl.textContent = "Åben for drift";
                operatingStatusTextEl.textContent =
                    "Dagens rutiner, registreringer og opfølgning vises som normalt.";
                heroStatusLabelEl.textContent = "Driftsoverblik";
                heroLiveChipEl.textContent = "Live data";
                statsLiveBadgeEl.textContent = "Live";
                routineStatusNoteEl.className = "routine-status-note";
                routineStatusNoteEl.innerHTML = "Visningen er klar til dagens registreringer.";
                routineAdminRowTextEl.textContent = "Normal drift er aktiv.";
            }

            const meta = [];
            meta.push(`<span class="operating-meta-pill">Status: ${escapeHtml(operatingState.statusText)}</span>`);

            if (operatingState.reason) {
                meta.push(`<span class="operating-meta-pill">Årsag: ${escapeHtml(operatingState.reason)}</span>`);
            }

            if (operatingState.untilDateKey) {
                meta.push(`<span class="operating-meta-pill">Gælder til: ${escapeHtml(operatingState.untilDateKey)}</span>`);
            }

            if (responsible) {
                meta.push(`<span class="operating-meta-pill">Admin: ${escapeHtml(SETTINGS.currentUserName)}</span>`);
            }

            operatingStatusMetaEl.innerHTML = meta.join("");
        }

        function renderTasks() {
            const overrideActive = operatingState.isClosed || operatingState.isVacation;

            if (overrideActive) {
                const modeText = operatingState.isClosed ? "lukket" : "ferie";
                renderEmptyState(
                    `Lokationen står som ${modeText} i dag. Derfor vises ingen normale rutiner, ingen røde mangler og ingen forvirrende medarbejderhandlinger.`,
                    true
                );
                updateKpis();
                return;
            }

            const visibleTasks = getVisibleTasks();

            if (!visibleTasks.length) {
                const hasTemplates = getTaskTemplates().length > 0;
                const deferredCount = allTasks.filter((task) => task?.registrationDeferred === true).length;
                renderEmptyState(
                    deferredCount > 0
                        ? `Der er ingen registreringer, der skal udføres lige nu. ${deferredCount} rutiner er planlagt, men registrering er udskudt efter frekvensreglerne.`
                        : hasTemplates
                        ? "Der er ikke flere aktive opgaver tilbage for i dag på denne lokation."
                        : "Der er ingen task-skabeloner endnu. Gå til risikoanalyse og generér task-skabeloner først."
                );
                updateKpis();
                return;
            }

            taskListEl.innerHTML = visibleTasks.map((task) => {
                const taskType = getTaskType(task);
                const areaName = getEquipmentName(task);

                const hasMin = task.minValue !== null && task.minValue !== undefined && task.minValue !== "";
                const hasMax = task.maxValue !== null && task.maxValue !== undefined && task.maxValue !== "";

                let limitText = "";
                if (hasMin && hasMax) {
                    limitText = `Grænse: ${task.minValue}-${task.maxValue}${task.measurementUnit || ""}`;
                } else if (hasMin) {
                    limitText = `Min: ${task.minValue}${task.measurementUnit || ""}`;
                } else if (hasMax) {
                    limitText = `Maks: ${task.maxValue}${task.measurementUnit || ""}`;
                }

                const visibleStatus = getVisibleStatus(task.status);
                const deadlineLabel = formatDeadlineLabel(task);
                const showOverdueNote = task.status === "overdue" && deadlineLabel;
                const createdAtLabel = formatDateTimeDa(getTaskCreatedAt(task));
                const handledAtLabel = formatDateTimeDa(getTaskHandledAt(task));

                return `
                    <article class="task-item" data-instance-id="${escapeHtml(task.id)}">
                        <div class="task-check">✓</div>

                        <div class="task-content">
                            <h4>${escapeHtml(getVisibleTitle(task))}</h4>
                            <p>${escapeHtml(task.description || "Daglig rutine")}</p>

                            <div class="task-meta">
                                ${
                                    areaName
                                        ? `<span class="task-pill">Område: ${escapeHtml(areaName)}</span>`
                                        : ""
                                }
                                <span class="task-pill">Kategori: ${escapeHtml(task.category || "Generel")}</span>
                                <span class="task-pill">Dato: ${escapeHtml(task.dateKey || "-")}</span>
                                <span class="task-pill">Oprettet: ${escapeHtml(createdAtLabel)}</span>
                                <span class="task-pill">Behandlet: ${escapeHtml(handledAtLabel)}</span>
                                ${deadlineLabel ? `<span class="task-pill ${task.status === "overdue" ? "is-warning" : ""}">Frist: ${escapeHtml(deadlineLabel)}</span>` : ""}
                                ${
                                    limitText
                                        ? `<span class="task-pill">${escapeHtml(limitText)}</span>`
                                        : ""
                                }
                                <span class="task-pill ${getStatusPillClass(task.status)}">Status: ${escapeHtml(visibleStatus)}</span>
                            </div>

                            ${(() => {
                                const assets = task.cloudinaryAssets || [];
                                const photoUrls = task.photoUrls || [];
                                const latestAsset = assets.length > 0 ? assets[assets.length - 1] : null;
                                const latestPhoto = photoUrls.length > 0 ? photoUrls[photoUrls.length - 1] : null;
                                const imageUrl = latestAsset?.optimizedUrl || latestAsset?.secureUrl || latestPhoto;
                                const aiDescription = latestAsset?.aiDescription || latestAsset?.beskrivelse || "";

                                if (imageUrl) {
                                    return `
                                        <div style="margin-top:12px;padding:10px;border:1px solid #d4e3d4;border-radius:10px;background:#f7fbf7;">
                                            <div style="display:flex;gap:10px;align-items:flex-start;">
                                                <img src="${escapeHtml(imageUrl)}" alt="Dokumentation" style="width:80px;height:80px;object-fit:cover;border-radius:8px;border:1px solid #d7e5d7;" />
                                                <div style="flex:1;min-width:0;">
                                                    <div style="font-weight:700;font-size:12px;color:#1f4727;margin-bottom:4px;">📸 Dokumentation</div>
                                                    ${aiDescription ? `<div style="font-size:12px;line-height:1.45;color:#2e3c2f;">${escapeHtml(aiDescription)}</div>` : '<div style="font-size:12px;color:#5e6b5e;">Billede uploadet</div>'}
                                                </div>
                                            </div>
                                        </div>
                                    `;
                                } else {
                                    return `
                                        <div style="margin-top:12px;padding:10px;border:1px solid #e0e0e0;border-radius:10px;background:#f9f9f9;display:flex;align-items:center;gap:8px;">
                                            <span style="font-size:20px;color:#999;">📷</span>
                                            <span style="font-size:12px;color:#666;">Ingen dokumentation endnu - klik Kamera for at tilføje</span>
                                        </div>
                                    `;
                                }
                            })()}

                            ${renderGuideToggle(task)}

                            ${
                                showOverdueNote
                                    ? `<div class="task-action-note">Rutinen er gået over tid. Når den gemmes nu, skal der skrives en forklaring på hvorfor den ikke blev udført inden fristen.</div>`
                                    : ""
                            }

                            <div class="routine-form">
                                ${
                                    task.controlType === "hot_holding"
                                        ? `
                                            <div class="routine-form-grid">
                                                <div style="grid-column:1 / -1;">
                                                    <label class="form-label" style="display:flex;align-items:center;gap:8px;">
                                                        <input
                                                            type="checkbox"
                                                            data-field="noUnderLimitEvents"
                                                            data-instance-id="${escapeHtml(task.id)}"
                                                            onchange="document.querySelectorAll('[data-instance-id=\\\"${escapeHtml(task.id)}\\\"][data-field]:not([data-field=\\\"noUnderLimitEvents\\\"]):not([data-field=\\\"comment\\\"])').forEach(el => el.disabled = this.checked)"
                                                        >
                                                        <span>Ingen retter under 65°C i dag</span>
                                                    </label>
                                                </div>

                                                <div>
                                                    <label class="form-label">Type</label>
                                                    <select
                                                        class="task-input"
                                                        data-field="foodType"
                                                        data-instance-id="${escapeHtml(task.id)}"
                                                    >
                                                        <option value="">Vælg type</option>
                                                        <option value="sauce">Sauce / sovs</option>
                                                        <option value="soup">Suppe</option>
                                                        <option value="meat">Tilberedt kød</option>
                                                        <option value="fish">Tilberedt fisk</option>
                                                        <option value="stew">Gryderet</option>
                                                        <option value="buffet">Buffetret</option>
                                                        <option value="other">Andet</option>
                                                    </select>
                                                </div>

                                                <div>
                                                    <label class="form-label">Navn på ret</label>
                                                    <input
                                                        type="text"
                                                        class="task-input"
                                                        data-field="dishName"
                                                        data-instance-id="${escapeHtml(task.id)}"
                                                        placeholder="fx Frikadeller i sovs"
                                                    >
                                                </div>

                                                <div>
                                                    <label class="form-label">Temperatur (°C)</label>
                                                    <input
                                                        type="number"
                                                        step="0.1"
                                                        class="task-input"
                                                        data-field="temperature"
                                                        data-instance-id="${escapeHtml(task.id)}"
                                                        placeholder="fx 72"
                                                        onchange="const val = parseFloat(this.value); const zoneRow = this.closest('.routine-form-grid').querySelector('[data-under-limit-row]'); if (zoneRow) { zoneRow.style.display = (val && val < 65) ? 'contents' : 'none'; }"
                                                    >
                                                </div>

                                                <div data-under-limit-row style="display:none;grid-column:1 / -1;padding:12px;border:1px solid #f0dfb7;border-radius:10px;background:#fffaf0;">
                                                    <div style="margin-bottom:10px;font-size:13px;font-weight:700;color:#7a5b16;">⚠️ Temperatur under 65°C - 3 timers regel</div>
                                                    <div class="routine-form-grid">
                                                        <div>
                                                            <label class="form-label">Zone / skab</label>
                                                            <select
                                                                class="task-input"
                                                                data-field="holdingZone"
                                                                data-instance-id="${escapeHtml(task.id)}"
                                                            >
                                                                <option value="">Vælg zone</option>
                                                                <option value="cabinet_1">Skab 1</option>
                                                                <option value="cabinet_2">Skab 2</option>
                                                                <option value="cabinet_3">Skab 3</option>
                                                                <option value="buffet">Buffet</option>
                                                                <option value="hot_case">Varmeskab</option>
                                                                <option value="other">Andet</option>
                                                            </select>
                                                        </div>
                                                        <div style="display:flex;align-items:flex-end;">
                                                            <button
                                                                type="button"
                                                                class="btn btn-secondary"
                                                                data-action="start_timer"
                                                                data-instance-id="${escapeHtml(task.id)}"
                                                                style="width:100%;"
                                                            >
                                                                Start 3 timers timer
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        `
                                        : task.controlType === "cooling"
                                        ? `
                                            <div class="routine-form-grid">
                                                <div style="grid-column:1 / -1;">
                                                    <label class="form-label">Målt afkøling indenfor 4 timer</label>
                                                    <select
                                                        class="task-input"
                                                        data-field="coolingDecision"
                                                        data-instance-id="${escapeHtml(task.id)}"
                                                        onchange="const isNoActivity = this.value === 'no_activity'; document.querySelectorAll('[data-instance-id=\\\"${escapeHtml(task.id)}\\\"][data-field=\\\"dishName\\\"],[data-instance-id=\\\"${escapeHtml(task.id)}\\\"][data-field=\\\"quantityBucket\\\"],[data-instance-id=\\\"${escapeHtml(task.id)}\\\"][data-field=\\\"coolingMethod\\\"]').forEach(el => el.disabled = isNoActivity);"
                                                        required
                                                    >
                                                        <option value="">Vælg resultat</option>
                                                        <option value="failed">Temperatur efter 4 timer er mere end 10 grader</option>
                                                        <option value="no_activity">Ingen nedkøling af fødevarer i denne uge</option>
                                                        <option value="ok">Nedkøling overholder temperaturvejledning på SITTI</option>
                                                        <option value="ok_verified">Temperaturen er faldet fra minimum 65 til max 10 grader på max 4 timer</option>
                                                    </select>
                                                </div>

                                                <div>
                                                    <label class="form-label">Navn på ret</label>
                                                    <input
                                                        type="text"
                                                        class="task-input"
                                                        data-field="dishName"
                                                        data-instance-id="${escapeHtml(task.id)}"
                                                        placeholder="fx lasagne / kødsovs / suppe"
                                                    >
                                                </div>

                                                <div>
                                                    <label class="form-label">Mængde</label>
                                                    <select
                                                        class="task-input"
                                                        data-field="quantityBucket"
                                                        data-instance-id="${escapeHtml(task.id)}"
                                                    >
                                                        <option value="">Vælg mængde</option>
                                                        <option value="lt_5kg">Under 5 kg</option>
                                                        <option value="kg_5_10">5-10 kg</option>
                                                        <option value="gt_10kg">Over 10 kg</option>
                                                    </select>
                                                </div>

                                                <div style="grid-column:1 / -1;">
                                                    <label class="form-label">Nedkølingsmetode</label>
                                                    <select
                                                        class="task-input"
                                                        data-field="coolingMethod"
                                                        data-instance-id="${escapeHtml(task.id)}"
                                                        onchange="const warningBox = this.closest('.routine-form-grid').querySelector('[data-cooling-warning]'); const quantity = document.querySelector('[data-instance-id=\\\"${escapeHtml(task.id)}\\\"][data-field=\\\"quantityBucket\\\"]')?.value; let msg = ''; if (quantity === 'gt_10kg' && this.value === 'fridge') { msg = '⚠️ Store mængder bør normalt opdeles i mindre beholdere eller nedkøles mere aktivt.'; } else if (this.value === 'cold_running_water' || this.value === 'ice_bath') { msg = 'ℹ️ Aktiv nedkøling er valgt.'; } if (warningBox) { warningBox.textContent = msg; warningBox.style.display = msg ? 'block' : 'none'; }"
                                                    >
                                                        <option value="">Vælg metode</option>
                                                        <option value="small_containers">Små beholdere</option>
                                                        <option value="fridge">Køleskab</option>
                                                        <option value="ice_bath">Isbad</option>
                                                        <option value="cold_running_water">Rindende koldt vand</option>
                                                        <option value="blast_chiller">Blast chiller</option>
                                                        <option value="stirring">Omrøring under nedkøling</option>
                                                        <option value="other">Andet</option>
                                                    </select>
                                                </div>

                                                <div data-cooling-warning style="display:none;grid-column:1 / -1;padding:10px;border-radius:8px;background:#f7fbf7;border:1px solid #d4e3d4;font-size:13px;color:#2e3c2f;"></div>
                                            </div>
                                        `
                                        : taskType === "measurement"
                                        ? `
                                            <div class="routine-form-grid">
                                                <div>
                                                    <label class="form-label">Måling (${escapeHtml(getUnit(task) || "")})</label>
                                                    <input
                                                        type="number"
                                                        step="0.1"
                                                        class="task-input"
                                                        data-field="measurementValue"
                                                        data-instance-id="${escapeHtml(task.id)}"
                                                        placeholder="${escapeHtml(getTaskPlaceholder(task))}"
                                                    >
                                                </div>

                                                <div>
                                                    <label class="form-label">Kommentar</label>
                                                    <input
                                                        type="text"
                                                        class="task-input"
                                                        data-field="comment"
                                                        data-instance-id="${escapeHtml(task.id)}"
                                                        placeholder="Skriv kommentar"
                                                    >
                                                </div>
                                            </div>
                                        `
                                        : `
                                            <div class="routine-form-grid">
                                                <div style="grid-column:1 / -1;">
                                                    <label class="form-label">Kommentar</label>
                                                    <input
                                                        type="text"
                                                        class="task-input"
                                                        data-field="comment"
                                                        data-instance-id="${escapeHtml(task.id)}"
                                                        placeholder="Skriv kommentar"
                                                    >
                                                </div>
                                            </div>
                                        `
                                }
                            </div>
                        </div>

                        <div class="task-action">
                            <button
                                type="button"
                                class="btn btn-primary task-save-btn"
                                data-instance-id="${escapeHtml(task.id)}"
                                data-action="save"
                            >
                                Fuldført
                            </button>

                            <button
                                type="button"
                                class="btn btn-secondary task-notused-btn"
                                data-instance-id="${escapeHtml(task.id)}"
                                data-action="not_in_use"
                            >
                                Ikke i brug
                            </button>

                            <button
                                type="button"
                                class="btn btn-secondary task-camera-btn"
                                data-open-camera="true"
                                data-instance-id="${escapeHtml(task.id)}"
                                data-task-id="${escapeHtml(task.taskId || "")}" 
                            >
                                Kamera
                            </button>

                            <button
                                type="button"
                                class="btn btn-secondary task-clean-btn"
                                data-instance-id="${escapeHtml(task.id)}"
                                data-action="cleaning_required"
                            >
                                Mangler rengøring
                            </button>

                            <button
                                type="button"
                                class="btn btn-secondary task-deviation-btn"
                                data-instance-id="${escapeHtml(task.id)}"
                                data-action="manual_deviation"
                            >
                                Opret afvigelse
                            </button>

                            <div class="task-action-note">
                                De tre nederste knapper kræver bekræftelse og sender videre til opfølgning.
                            </div>
                        </div>

                        ${renderGuidePanel(task)}
                    </article>
                `;
            }).join("");

            bindGuideToggles();
            updateKpis();
        }

        function bindGuideToggles() {
            document.querySelectorAll("[data-guide-toggle]").forEach((button) => {
                button.addEventListener("click", () => {
                    const taskId = button.getAttribute("data-guide-toggle");
                    if (!taskId) return;

                    const panel = document.querySelector(`[data-guide-panel="${CSS.escape(taskId)}"]`);
                    if (!panel) return;

                    const isExpanded = button.getAttribute("aria-expanded") === "true";
                    button.setAttribute("aria-expanded", String(!isExpanded));
                    panel.hidden = isExpanded;
                });
            });
        }

        function getInputValue(instanceId, field) {
            const input = document.querySelector(`[data-instance-id="${CSS.escape(instanceId)}"][data-field="${field}"]`);
            return input ? input.value : null;
        }

        function renderAiPreviewCard(actionEl, { instanceId, imageUrl, aiResult }) {
            if (!actionEl || !aiResult) return;

            let preview = actionEl.querySelector(".task-ai-preview");
            if (!preview) {
                preview = document.createElement("div");
                preview.className = "task-ai-preview";
                preview.style.cssText = "margin-top:8px;padding:10px;border:1px solid #d4e3d4;border-radius:10px;background:#f7fbf7;";
                actionEl.appendChild(preview);
            }

            const confidencePct = Number.isFinite(Number(aiResult.confidence))
                ? `${Math.round(Number(aiResult.confidence) * 100)}%`
                : "-";

            preview.innerHTML = `
                <div style="display:flex;gap:10px;align-items:flex-start;">
                    <img src="${imageUrl}" alt="AI preview" style="width:72px;height:72px;object-fit:cover;border-radius:8px;border:1px solid #d7e5d7;" />
                    <div style="flex:1;min-width:0;">
                        <div style="font-weight:800;font-size:12px;color:#1f4727;">AI-forslag (${confidencePct})</div>
                        <div style="margin-top:4px;font-size:12px;line-height:1.45;color:#2e3c2f;">${escapeHtml(aiResult.beskrivelse || "")}</div>
                        <button type="button" class="btn btn-secondary" data-ai-approve="${escapeHtml(instanceId)}" style="margin-top:8px;min-height:32px;padding:6px 10px;font-size:12px;">Godkend AI-forslag</button>
                    </div>
                </div>
            `;

            const approveBtn = preview.querySelector("button[data-ai-approve]");
            if (approveBtn) {
                approveBtn.addEventListener("click", () => {
                    const commentInput = document.querySelector(`[data-instance-id="${CSS.escape(instanceId)}"][data-field="comment"]`);
                    if (commentInput && aiResult.beskrivelse) {
                        commentInput.value = aiResult.beskrivelse;
                        commentInput.dispatchEvent(new Event("input", { bubbles: true }));
                    }
                    approveBtn.textContent = "AI godkendt";
                    approveBtn.disabled = true;
                });
            }
        }

        function getActionConfirmConfig(task, actionType) {
            const title = getVisibleTitle(task);

            if (actionType === "not_in_use") {
                return {
                    shouldConfirm: true,
                    message: `Er du sikker på at "${title}" skal markeres som ikke i brug?\n\nRutinen fjernes fra dagens liste og registreres som ikke i brug.`
                };
            }

            if (actionType === "cleaning_required") {
                return {
                    shouldConfirm: true,
                    message: `Er du sikker på at "${title}" skal markeres som mangler rengøring?\n\nDet opretter en afvigelse og sender dig videre til opfølgning.`
                };
            }

            if (actionType === "manual_deviation") {
                return {
                    shouldConfirm: true,
                    message: `Er du sikker på at du vil oprette en afvigelse på "${title}"?\n\nDet sender dig videre til afvigelser.`
                };
            }

            return {
                shouldConfirm: false,
                message: ""
            };
        }

        function confirmTaskAction(task, actionType) {
            const config = getActionConfirmConfig(task, actionType);

            if (!config.shouldConfirm) {
                return true;
            }

            return window.confirm(config.message);
        }

        function getTaskContextDetails(task) {
            const rawMachine = String(task.machineName || task.equipmentName || "").trim();
            const rawArea = String(task.areaName || task.zoneName || task.roomName || "").trim();
            const rawAreaType = String(task.areaType || task.zoneType || task.equipmentType || "").trim();

            let machineName = rawMachine;
            let areaName = rawArea;

            if (!areaName && machineName && /\si\s/i.test(machineName)) {
                const parts = machineName.split(/\si\s/i);
                if (parts.length >= 2) {
                    machineName = String(parts[0] || "").trim();
                    areaName = String(parts.slice(1).join(" i ") || "").trim();
                }
            }

            const searchable = [
                task.title,
                task.description,
                task.controlPoint,
                task.guideTitle,
                task.guideIntro,
                areaName,
                machineName
            ].map((value) => String(value || "").toLowerCase()).join(" ");

            if (!areaName) {
                if (searchable.includes("varmkøkken") || searchable.includes("varm køkken")) areaName = "Varmkøkken";
                else if (searchable.includes("koldkøkken") || searchable.includes("kold køkken")) areaName = "Koldkøkken";
                else if (searchable.includes("walk") && (searchable.includes("frys") || searchable.includes("freez"))) areaName = "Walk-in fryser";
                else if (searchable.includes("walk") && (searchable.includes("køl") || searchable.includes("kol") || searchable.includes("cool"))) areaName = "Walk-in køl";
                else if (searchable.includes("grønt") || searchable.includes("gront")) areaName = "Grøntsagsrum";
                else if (searchable.includes("opvask") || searchable.includes("dishwasher")) areaName = "Opvaskrum";
            }

            const specificLabel = machineName && areaName
                ? `${machineName} i ${areaName}`
                : (machineName || areaName || getVisibleTitle(task));

            return {
                machineName,
                areaName,
                areaType: rawAreaType,
                specificLabel
            };
        }

        function evaluateTaskResult(task, entryData, actionType = "save") {
            const context = getTaskContextDetails(task);
            const areaText = context.specificLabel ? ` på ${context.specificLabel}` : "";

            if (actionType === "not_in_use") {
                return {
                    entryStatus: "not_in_use",
                    instanceStatus: "not_in_use",
                    shouldCreateAlert: false,
                    alertTitle: "",
                    alertDescription: "",
                    contextMachineName: context.machineName,
                    contextAreaName: context.areaName,
                    contextAreaType: context.areaType,
                    contextSpecificLabel: context.specificLabel
                };
            }

            if (actionType === "cleaning_required") {
                return {
                    entryStatus: "cleaning_required",
                    instanceStatus: "cleaning_required",
                    shouldCreateAlert: true,
                    alertType: "cleaning_required",
                    alertTitle: context.specificLabel
                        ? `${context.specificLabel} mangler rengøring`
                        : "Område mangler rengøring",
                    alertDescription: context.specificLabel
                        ? `${context.specificLabel} er markeret som mangler rengøring og tømning/kontrol skal udføres.`
                        : "Et område er markeret som mangler rengøring.",
                    contextMachineName: context.machineName,
                    contextAreaName: context.areaName,
                    contextAreaType: context.areaType,
                    contextSpecificLabel: context.specificLabel
                };
            }

            if (actionType === "manual_deviation") {
                return {
                    entryStatus: "failed",
                    instanceStatus: "failed",
                    shouldCreateAlert: true,
                    alertType: "manual_deviation",
                    alertTitle: context.specificLabel
                        ? `Afvigelse registreret – ${context.specificLabel}`
                        : "Afvigelse registreret",
                    alertDescription: context.specificLabel
                        ? `Der er registreret en afvigelse for ${context.specificLabel}. Dokumentér helt ned i detaljer hvad der mangler og hvor.`
                        : "Der er registreret en afvigelse.",
                    contextMachineName: context.machineName,
                    contextAreaName: context.areaName,
                    contextAreaType: context.areaType,
                    contextSpecificLabel: context.specificLabel
                };
            }

            if (getTaskType(task) === "measurement") {
                const numericValue = Number(entryData.measurementValue);

                if (
                    task.maxValue !== null &&
                    task.maxValue !== undefined &&
                    task.maxValue !== "" &&
                    numericValue > Number(task.maxValue)
                ) {
                    return {
                        entryStatus: "failed",
                        instanceStatus: "failed",
                        shouldCreateAlert: true,
                        alertType: task.equipmentType === "freezer"
                            ? "freezer_temperature_out_of_range"
                            : "temperature_out_of_range",
                        alertTitle: context.specificLabel
                            ? `${context.specificLabel} temperatur over grænse`
                            : "Temperatur over grænse",
                        alertDescription: `Registreret temperatur${areaText} var ${numericValue}${task.measurementUnit || ""}.`,
                        contextMachineName: context.machineName,
                        contextAreaName: context.areaName,
                        contextAreaType: context.areaType,
                        contextSpecificLabel: context.specificLabel
                    };
                }

                if (
                    task.minValue !== null &&
                    task.minValue !== undefined &&
                    task.minValue !== "" &&
                    numericValue < Number(task.minValue)
                ) {
                    return {
                        entryStatus: "failed",
                        instanceStatus: "failed",
                        shouldCreateAlert: true,
                        alertType: "temperature_out_of_range",
                        alertTitle: context.specificLabel
                            ? `${context.specificLabel} temperatur under grænse`
                            : "Temperatur under grænse",
                        alertDescription: `Registreret temperatur${areaText} var ${numericValue}${task.measurementUnit || ""}.`,
                        contextMachineName: context.machineName,
                        contextAreaName: context.areaName,
                        contextAreaType: context.areaType,
                        contextSpecificLabel: context.specificLabel
                    };
                }
            }

            return {
                entryStatus: "completed",
                instanceStatus: "completed",
                shouldCreateAlert: false,
                alertType: "",
                alertTitle: "",
                alertDescription: "",
                contextMachineName: context.machineName,
                contextAreaName: context.areaName,
                contextAreaType: context.areaType,
                contextSpecificLabel: context.specificLabel
            };
        }

        async function alertAlreadyExists(taskInstanceId, title = "") {
            let snapshot;

            try {
                const alertsQuery = query(
                    collection(db, "alerts"),
                    where("companyId", "==", SETTINGS.companyId),
                    where("locationId", "==", SETTINGS.locationId),
                    where("sourceTaskInstanceId", "==", taskInstanceId),
                    where("dateKey", "==", getTodayKey()),
                    where("status", "==", "open")
                );

                snapshot = await getDocs(alertsQuery);
            } catch (error) {
                const alertsQueryLegacy = query(
                    collection(db, "alerts"),
                    where("organizationId", "==", SETTINGS.companyId),
                    where("locationId", "==", SETTINGS.locationId),
                    where("sourceTaskInstanceId", "==", taskInstanceId),
                    where("dateKey", "==", getTodayKey()),
                    where("status", "==", "open")
                );

                snapshot = await getDocs(alertsQueryLegacy);
            }

            if (snapshot.empty) return false;
            if (!title) return true;

            return snapshot.docs.some((item) => {
                const data = item.data();
                return data.title === title;
            });
        }

        async function maybeCreateAlert(task, entryData, entryId, result) {
            if (operatingState.isClosed || operatingState.isVacation) return;
            if (!result.shouldCreateAlert) return;

            const exists = await alertAlreadyExists(task.id, result.alertTitle);
            if (exists) return;

            const areaName = result.contextAreaName || getEquipmentName(task);

            await addDoc(collection(db, "alerts"), {
                companyId: SETTINGS.companyId,
                organizationId: SETTINGS.companyId,
                unitId: SETTINGS.unitId,
                locationId: SETTINGS.locationId,
                alertType: result.alertType || "task_failure",
                severity: task.alertSeverityOnFailure || "medium",
                status: "open",
                title: result.alertTitle,
                description: result.alertDescription,
                equipmentId: task.equipmentId || "",
                equipmentName: task.equipmentName || "",
                equipmentType: task.equipmentType || "",
                riskId: Array.isArray(task.linkedRiskIds) && task.linkedRiskIds.length ? task.linkedRiskIds[0] : "",
                sourceTaskId: task.taskId || "",
                sourceTaskInstanceId: task.id,
                sourceType: "task_entry",
                sourceId: entryId || "",
                dateKey: getTodayKey(),
                assignedTo: SETTINGS.employeeName,
                requiresAction: true,
                machineName: result.contextMachineName || task.machineName || task.equipmentName || null,
                areaName: areaName || null,
                areaType: result.contextAreaType || task.areaType || task.equipmentType || null,
                specificLabel: result.contextSpecificLabel || null,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });

            alertCount += 1;
        }

        async function overdueEntryExists(taskInstanceId) {
            let snapshot;

            try {
                const overdueQuery = query(
                    collection(db, "task_entries"),
                    where("companyId", "==", SETTINGS.companyId),
                    where("locationId", "==", SETTINGS.locationId),
                    where("taskInstanceId", "==", taskInstanceId),
                    where("actionType", "==", "auto_overdue")
                );

                snapshot = await getDocs(overdueQuery);
            } catch (error) {
                const overdueQueryLegacy = query(
                    collection(db, "task_entries"),
                    where("organizationId", "==", SETTINGS.companyId),
                    where("locationId", "==", SETTINGS.locationId),
                    where("taskInstanceId", "==", taskInstanceId),
                    where("actionType", "==", "auto_overdue")
                );

                snapshot = await getDocs(overdueQueryLegacy);
            }

            return !snapshot.empty;
        }

        async function maybeMarkTaskOverdue(task) {
            if (!isTaskOverdue(task)) return false;
            if (task.status === "overdue") return false;

            const deadlineLabel = formatDeadlineLabel(task);
            const alreadyLogged = await overdueEntryExists(task.id);

            await updateDoc(doc(db, "task_instances", task.id), {
                status: "overdue",
                overdueAt: serverTimestamp(),
                overdueDateKey: getTodayKey(),
                updatedAt: serverTimestamp()
            });

            if (!alreadyLogged) {
                await addDoc(collection(db, "task_entries"), {
                    taskInstanceId: task.id,
                    taskId: task.taskId || "",
                    companyId: SETTINGS.companyId,
                    organizationId: SETTINGS.companyId,
                    unitId: SETTINGS.unitId,
                    locationId: SETTINGS.locationId,
                    taskTitle: task.title || "",
                    taskType: task.type || task.category || "",
                    equipmentId: task.equipmentId || "",
                    equipmentName: task.equipmentName || "",
                    entryType: "deadline_missed",
                    measurementValue: null,
                    measurementUnit: task.measurementUnit || "",
                    valueLabel: "Gået over tid",
                    status: "failed",
                    note: deadlineLabel
                        ? `Rutinen blev ikke udført inden fristen ${deadlineLabel}.`
                        : "Rutinen blev ikke udført inden fristen.",
                    dateKey: getTodayKey(),
                    deadlineAt: task.deadlineAt || "",
                    overdueLogged: true,
                    completedLate: false,
                    completedBy: "system",
                    completedByName: "System",
                    completedAt: serverTimestamp(),
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                    actionType: "auto_overdue"
                });
            }

            const result = {
                shouldCreateAlert: true,
                alertType: "task_overdue",
                alertTitle: task.equipmentName
                    ? `${task.equipmentName} rutine er gået over tid`
                    : "Rutine er gået over tid",
                alertDescription: deadlineLabel
                    ? `Rutinen blev ikke udført inden fristen ${deadlineLabel}.`
                    : "Rutinen blev ikke udført inden fristen."
            };

            await maybeCreateAlert(task, {}, "", result);

            task.status = "overdue";
            task.overdueAt = new Date().toISOString();
            return true;
        }

        async function syncOverdueTasks() {
            let changed = false;

            for (const task of allTasks) {
                const didChange = await maybeMarkTaskOverdue(task);
                if (didChange) {
                    changed = true;
                }
            }

            return changed;
        }

        function buildEntryData(task, actionType = "save") {
            const taskType = getTaskType(task);
            let comment = (getInputValue(task.id, "comment") || "").trim();
            const context = getTaskContextDetails(task);

            // Handle hot_holding control type
            if (task.controlType === "hot_holding" && actionType === "save") {
                const noUnderLimitCheckbox = document.querySelector(`[data-instance-id="${CSS.escape(task.id)}"][data-field="noUnderLimitEvents"]`);
                const noUnderLimitEvents = noUnderLimitCheckbox ? noUnderLimitCheckbox.checked : false;

                // FLOW C: No under-limit events confirmation
                if (noUnderLimitEvents) {
                    return {
                        entryType: "confirmation",
                        confirmationType: "no_under_limit_events",
                        note: comment || "Ingen retter under 65°C i dag - kontrol udført",
                        actionType: "completed",
                        status: "completed"
                    };
                }

                // FLOW A & B: Normal measurement or under 65°C with timer
                const foodType = (getInputValue(task.id, "foodType") || "").trim();
                const dishName = (getInputValue(task.id, "dishName") || "").trim();
                const rawTemp = getInputValue(task.id, "temperature");
                const temperature = rawTemp === null || rawTemp === "" ? null : Number(rawTemp);

                if (!foodType) {
                    throw new Error("Type er påkrævet for varmholdelse");
                }
                if (!dishName) {
                    throw new Error("Navn på ret er påkrævet for varmholdelse");
                }
                if (temperature === null || Number.isNaN(temperature)) {
                    throw new Error("Temperatur er påkrævet for varmholdelse");
                }

                // FLOW A: Normal measurement (>= 65°C)
                if (temperature >= 65) {
                    return {
                        entryType: "measurement",
                        measurementValue: temperature,
                        measurementUnit: "C",
                        contextFields: {
                            foodType: foodType,
                            dishName: dishName
                        },
                        note: comment || `Varmholdelse: ${dishName} (${foodType}) ved ${temperature}°C`,
                        actionType: "completed",
                        status: "completed"
                    };
                }

                // FLOW B: Under 65°C - cannot complete without timer
                throw new Error("Temperatur under 65°C kræver at du starter 3 timers timer. Brug 'Start 3 timers timer' knappen.");
            }

            // Handle hot_holding timer start
            if (task.controlType === "hot_holding" && actionType === "start_timer") {
                const foodType = (getInputValue(task.id, "foodType") || "").trim();
                const dishName = (getInputValue(task.id, "dishName") || "").trim();
                const rawTemp = getInputValue(task.id, "temperature");
                const temperature = rawTemp === null || rawTemp === "" ? null : Number(rawTemp);
                const holdingZone = (getInputValue(task.id, "holdingZone") || "").trim();

                if (!foodType || !dishName || temperature === null || Number.isNaN(temperature)) {
                    throw new Error("Udfyld type, navn og temperatur først");
                }
                if (!holdingZone) {
                    throw new Error("Vælg zone/skab før timer startes");
                }
                if (temperature >= 65) {
                    throw new Error("Timer er kun nødvendig for temperaturer under 65°C");
                }

                const now = new Date();
                const expiresAt = new Date(now.getTime() + 180 * 60 * 1000);

                return {
                    entryType: "measurement",
                    measurementValue: temperature,
                    measurementUnit: "C",
                    contextFields: {
                        foodType: foodType,
                        dishName: dishName,
                        holdingZone: holdingZone
                    },
                    hotHoldingTimer: {
                        startedAt: now.toISOString(),
                        limitMinutes: 180,
                        expiresAt: expiresAt.toISOString(),
                        status: "running"
                    },
                    note: comment || `Varmholdelse under 65°C: ${dishName} (${foodType}) ved ${temperature}°C i ${holdingZone}. 3 timers timer startet.`,
                    actionType: "under_limit_timer_started",
                    status: "warning"
                };
            }

            // Handle cooling control type
            if (task.controlType === "cooling" && actionType === "save") {
                const coolingDecision = (getInputValue(task.id, "coolingDecision") || "").trim();
                const dishName = (getInputValue(task.id, "dishName") || "").trim();
                const quantityBucket = (getInputValue(task.id, "quantityBucket") || "").trim();
                const coolingMethod = (getInputValue(task.id, "coolingMethod") || "").trim();

                if (!coolingDecision) {
                    throw new Error("Vælg et nedkølingsresultat");
                }

                // Validation for non-no_activity cases
                if (coolingDecision !== "no_activity") {
                    if (!dishName) {
                        throw new Error("Navn på ret er påkrævet");
                    }
                    if (!quantityBucket) {
                        throw new Error("Mængde er påkrævet");
                    }
                    if (!coolingMethod) {
                        throw new Error("Nedkølingsmetode er påkrævet");
                    }
                    if (coolingMethod === "other" && !comment) {
                        throw new Error("Beskriv nedkølingsmetoden når 'Andet' er valgt");
                    }
                }

                // If failed, require corrective action
                if (coolingDecision === "failed" && !comment) {
                    throw new Error("Korrigerende handling er påkrævet når nedkøling fejler. Beskriv hvad der skal gøres.");
                }

                const contextFields = {};
                if (dishName) contextFields.dishName = dishName;
                if (quantityBucket) contextFields.quantityBucket = quantityBucket;
                if (coolingMethod) contextFields.coolingMethod = coolingMethod;

                return {
                    entryType: "decision",
                    decisionValue: coolingDecision,
                    contextFields: contextFields,
                    note: comment || `Nedkøling: ${coolingDecision}${dishName ? ` - ${dishName}` : ""}${quantityBucket ? ` (${quantityBucket})` : ""}${coolingMethod ? ` via ${coolingMethod}` : ""}`,
                    actionType: "completed",
                    status: coolingDecision === "failed" ? "failed" : "completed"
                };
            }

            function getCurrentTimeLabel() {
                return new Intl.DateTimeFormat("da-DK", {
                    hour: "2-digit",
                    minute: "2-digit"
                }).format(new Date());
            }

            function buildAutoDocumentationNote(measurementValue = null, measurementUnit = "") {
                const timeLabel = getCurrentTimeLabel();
                const scope = context.specificLabel || getVisibleTitle(task);
                const searchable = [
                    task.title,
                    task.description,
                    task.controlPoint,
                    scope,
                    context.machineName,
                    context.areaName,
                    task.equipmentType
                ].map((value) => String(value || "").toLowerCase()).join(" ");

                if (searchable.includes("softice") || searchable.includes("soft ice")) {
                    return `${scope} rengjort og desinficeret kl. ${timeLabel}. Tappetud, pakninger, slanger og drypbakke kontrolleret.`;
                }

                if (searchable.includes("ovn") || searchable.includes("oven")) {
                    const measurementText = measurementValue !== null
                        ? ` Temperatur registreret: ${measurementValue}${measurementUnit || ""}.`
                        : "";
                    return `${scope} rengjort kl. ${timeLabel}. Lister, pakninger og blæser kontrolleret.${measurementText}`;
                }

                if (searchable.includes("opvask") || searchable.includes("dishwasher") || searchable.includes("industriopvask")) {
                    const measurementText = measurementValue !== null
                        ? ` Vaske/skylletemperatur: ${measurementValue}${measurementUnit || ""}.`
                        : "";
                    return `${scope} rengjort kl. ${timeLabel}. Filter og dyser kontrolleret.${measurementText}`;
                }

                if (taskType === "temperature" || searchable.includes("temperatur") || searchable.includes("køleskab") || searchable.includes("fryser")) {
                    const measurementText = measurementValue !== null
                        ? ` Temperatur: ${measurementValue}${measurementUnit || ""}.`
                        : "";
                    return `${scope} kontrolleret kl. ${timeLabel}. Kondens, pakninger, lister og tæthed gennemgået.${measurementText}`;
                }

                if (measurementValue !== null) {
                    return `${scope} udført kl. ${timeLabel}. Måling registreret: ${measurementValue}${measurementUnit || ""}. Område/maskine dokumenteret.`;
                }

                return `${scope} udført kl. ${timeLabel}. Område/maskine kontrolleret og dokumenteret.`;
            }

            const aiSuggestion = aiSuggestionsByInstance.get(task.id) || null;

            if (actionType === "save" && task.status === "overdue" && !comment) {
                throw new Error("Forklaring er påkrævet, fordi rutinen er gået over tid.");
            }

            if (actionType === "save" && !comment) {
                comment = aiSuggestion?.beskrivelse || buildAutoDocumentationNote();
            }

            if (actionType === "not_in_use") {
                if (!comment) comment = "Markeret som ikke i brug";
                return {
                    entryType: taskType === "measurement" ? "measurement" : "check",
                    measurementValue: null,
                    measurementUnit: getUnit(task) || "",
                    valueLabel: "Ikke i brug",
                    note: comment,
                    handling_udfort: aiSuggestion ? aiSuggestion.handlingUdfort : false,
                    beskrivelse: aiSuggestion?.beskrivelse || comment,
                    ai_source: aiSuggestion ? "vision_ai" : "manual",
                    ai_confidence: aiSuggestion ? aiSuggestion.confidence : null,
                    ai_category: aiSuggestion?.category || "egenkontrol"
                };
            }

            if (actionType === "cleaning_required") {
                if (!comment) {
                    throw new Error("Skriv hvad der mangler rengøring, før du opretter afvigelsen.");
                }
                return {
                    entryType: taskType === "measurement" ? "measurement" : "check",
                    measurementValue: null,
                    measurementUnit: getUnit(task) || "",
                    valueLabel: "Mangler rengøring",
                    note: comment,
                    handling_udfort: aiSuggestion ? aiSuggestion.handlingUdfort : false,
                    beskrivelse: aiSuggestion?.beskrivelse || comment,
                    ai_source: aiSuggestion ? "vision_ai" : "manual",
                    ai_confidence: aiSuggestion ? aiSuggestion.confidence : null,
                    ai_category: aiSuggestion?.category || "egenkontrol"
                };
            }

            if (actionType === "manual_deviation") {
                if (!comment) {
                    throw new Error("Skriv afvigelsesforklaring, før du opretter afvigelsen.");
                }
                return {
                    entryType: taskType === "measurement" ? "measurement" : "check",
                    measurementValue: null,
                    measurementUnit: getUnit(task) || "",
                    valueLabel: "Afvigelse",
                    note: comment,
                    handling_udfort: aiSuggestion ? aiSuggestion.handlingUdfort : false,
                    beskrivelse: aiSuggestion?.beskrivelse || comment,
                    ai_source: aiSuggestion ? "vision_ai" : "manual",
                    ai_confidence: aiSuggestion ? aiSuggestion.confidence : null,
                    ai_category: aiSuggestion?.category || "egenkontrol"
                };
            }

            // Standard measurement handling (not hot_holding or cooling)
            if (taskType === "measurement") {
                const rawValue = getInputValue(task.id, "measurementValue");
                const measurementValue = rawValue === null || rawValue === "" ? null : Number(rawValue);

                if (measurementValue === null || Number.isNaN(measurementValue)) {
                    throw new Error("Måling mangler");
                }

                if (!comment) {
                    comment = buildAutoDocumentationNote(measurementValue, getUnit(task));
                }

                return {
                    entryType: "measurement",
                    measurementValue,
                    measurementUnit: getUnit(task),
                    valueLabel: "",
                    note: comment,
                    handling_udfort: aiSuggestion ? aiSuggestion.handlingUdfort : true,
                    beskrivelse: aiSuggestion?.beskrivelse || comment,
                    ai_source: aiSuggestion ? "vision_ai" : "manual",
                    ai_confidence: aiSuggestion ? aiSuggestion.confidence : null,
                    ai_category: aiSuggestion?.category || "egenkontrol"
                };
            }

            return {
                entryType: "check",
                measurementValue: null,
                measurementUnit: "",
                valueLabel: "Fuldført",
                note: comment,
                handling_udfort: aiSuggestion ? aiSuggestion.handlingUdfort : true,
                beskrivelse: aiSuggestion?.beskrivelse || comment,
                ai_source: aiSuggestion ? "vision_ai" : "manual",
                ai_confidence: aiSuggestion ? aiSuggestion.confidence : null,
                ai_category: aiSuggestion?.category || "egenkontrol"
            };
        }

        function redirectToFollowUp(task, actionType, note = "") {
            const context = getTaskContextDetails(task);
            const url = new URL("/modules/egenkontrol/afvigelser.html", window.location.origin);
            url.searchParams.set("taskInstanceId", task.id);
            url.searchParams.set("taskId", task.taskId || "");
            url.searchParams.set("actionType", actionType);
            url.searchParams.set("locationId", SETTINGS.locationId);
            url.searchParams.set("title", task.title || "");
            url.searchParams.set("equipmentName", task.equipmentName || "");
            url.searchParams.set("machineName", context.machineName || "");
            url.searchParams.set("specificLabel", context.specificLabel || "");
            url.searchParams.set("category", task.category || "");
            if (note) {
                url.searchParams.set("comment", note);
            }
            url.searchParams.set("areaName", context.areaName || task.areaName || task.controlPoint || "");
            url.searchParams.set("areaType", context.areaType || task.areaType || task.equipmentType || "");
            window.location.href = url.toString();
        }

        async function saveTask(task, actionType = "save") {
            if ((operatingState.isClosed || operatingState.isVacation) && !userIsResponsible()) {
                throw new Error("Kan ikke gemme normale rutiner når lukket eller ferie er aktiv.");
            }

            const entryData = buildEntryData(task, actionType);
            const result = evaluateTaskResult(task, entryData, actionType);

            const response = await saveRoutineTaskCallable({
                companyId: SETTINGS.companyId,
                locationId: SETTINGS.locationId,
                unitId: SETTINGS.unitId,
                taskInstanceId: task.id,
                taskId: task.taskId || "",
                taskDateKey: task.dateKey || getTodayKey(),
                actionType,
                completedBy: SETTINGS.createdBy,
                completedByName: SETTINGS.employeeName,
                deadlineAt: task.deadlineAt || "",
                completedLate: task.status === "overdue",
                overdueLogged: task.status === "overdue",
                entryData,
                result
            });

            return response?.data?.status || result.instanceStatus;
        }

        function removeTaskCard(instanceId, newStatus) {
            const task = allTasks.find((item) => item.id === instanceId);
            if (task) {
                task.status = newStatus;
            }

            const card = document.querySelector(`.task-item[data-instance-id="${CSS.escape(instanceId)}"]`);
            if (card) {
                card.remove();
            }

            const remainingVisibleCards = taskListEl.querySelectorAll(".task-item").length;
            if (remainingVisibleCards === 0) {
                renderEmptyState();
            }

            updateKpis();
        }

        function setCardLoading(instanceId, isLoading, buttonText = "Gemmer...") {
            const card = document.querySelector(`.task-item[data-instance-id="${CSS.escape(instanceId)}"]`);
            if (!card) return;

            if (isLoading) {
                card.dataset.state = "saving";
            } else {
                delete card.dataset.state;
            }

            const buttons = card.querySelectorAll("button[data-action]");
            buttons.forEach((button) => {
                button.disabled = isLoading;

                if (isLoading && button.classList.contains("is-active-action")) {
                    button.textContent = buttonText;
                }
            });

            const inputs = card.querySelectorAll("input");
            inputs.forEach((input) => {
                input.disabled = isLoading;
            });
        }

        function clearActiveAction(instanceId, originalLabels = {}) {
            const card = document.querySelector(`.task-item[data-instance-id="${CSS.escape(instanceId)}"]`);
            if (!card) return;

            card.querySelectorAll("button[data-action]").forEach((button) => {
                button.classList.remove("is-active-action");
                const original = originalLabels[button.dataset.action];
                if (original) {
                    button.textContent = original;
                }
            });
        }

        async function handleTaskAction(button) {
            if ((operatingState.isClosed || operatingState.isVacation) && !userIsResponsible()) {
                alert("Lokationen er lukket eller i ferie-mode. Normale rutinehandlinger er derfor sat på pause.");
                return;
            }

            const instanceId = button.dataset.instanceId;
            const actionType = button.dataset.action;
            const task = allTasks.find((item) => item.id === instanceId);

            if (!task) return;
            if (processingTaskIds.has(instanceId)) return;

            if (!confirmTaskAction(task, actionType)) {
                return;
            }

            processingTaskIds.add(instanceId);

            const card = document.querySelector(`.task-item[data-instance-id="${CSS.escape(instanceId)}"]`);
            if (!card) {
                processingTaskIds.delete(instanceId);
                return;
            }

            const originalLabels = {};
            card.querySelectorAll("button[data-action]").forEach((btn) => {
                originalLabels[btn.dataset.action] = btn.textContent;
                btn.classList.remove("is-active-action");
            });

            button.classList.add("is-active-action");
            setCardLoading(instanceId, true, "Gemmer...");

            try {
                const newStatus = await saveTask(task, actionType);

                if (actionType === "save" || actionType === "not_in_use") {
                    removeTaskCard(instanceId, newStatus);
                } else {
                    task.status = newStatus;
                    updateKpis();
                    const followUpNote = (getInputValue(task.id, "comment") || "").trim();
                    redirectToFollowUp(task, actionType, followUpNote);
                }
            } catch (error) {
                console.error("Fejl ved gemning:", error);
                alert(error.message || "Kunne ikke gemme registreringen.");
                setCardLoading(instanceId, false);
                clearActiveAction(instanceId, originalLabels);
            } finally {
                processingTaskIds.delete(instanceId);
            }
        }

        taskListEl.addEventListener("click", async (event) => {
            const cameraButton = event.target.closest("button[data-open-camera][data-instance-id]");
            if (cameraButton) {
                event.preventDefault();
                const instanceId = cameraButton.dataset.instanceId;
                if (!instanceId) return;
                const task = allTasks.find((item) => item.id === instanceId) || null;

                const input = document.createElement("input");
                input.type = "file";
                input.accept = "image/*";
                input.capture = "environment";

                input.addEventListener("change", async () => {
                    const file = input.files?.[0];
                    if (!file) return;

                    async function optimizeImageForUpload(rawFile, enhanceForDocumentScanning = true) {
                        const maxWidth = 1200;
                        const jpegQuality = 0.85;
                        try {
                            const image = await new Promise((resolve, reject) => {
                                const objectUrl = URL.createObjectURL(rawFile);
                                const img = new Image();
                                img.onload = () => {
                                    URL.revokeObjectURL(objectUrl);
                                    resolve(img);
                                };
                                img.onerror = () => {
                                    URL.revokeObjectURL(objectUrl);
                                    reject(new Error("Kunne ikke laese billedfil."));
                                };
                                img.src = objectUrl;
                            });

                            const width = Number(image.naturalWidth || image.width || 0);
                            const height = Number(image.naturalHeight || image.height || 0);
                            if (!width || !height) return rawFile;

                            const scale = width > maxWidth ? maxWidth / width : 1;
                            const targetWidth = Math.max(1, Math.round(width * scale));
                            const targetHeight = Math.max(1, Math.round(height * scale));

                            const canvas = document.createElement("canvas");
                            canvas.width = targetWidth;
                            canvas.height = targetHeight;
                            const ctx = canvas.getContext("2d");
                            if (!ctx) return rawFile;
                            
                            ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

                            if (enhanceForDocumentScanning) {
                                const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
                                const data = imageData.data;

                                let totalBrightness = 0;
                                for (let i = 0; i < data.length; i += 4) {
                                    const r = data[i];
                                    const g = data[i + 1];
                                    const b = data[i + 2];
                                    totalBrightness += (r + g + b) / 3;
                                }
                                const avgBrightness = totalBrightness / (data.length / 4);
                                const isDark = avgBrightness < 100;

                                if (isDark) {
                                    const brightnessFactor = 1.4;
                                    const contrastFactor = 1.3;
                                    const contrastOffset = 128 * (1 - contrastFactor);

                                    for (let i = 0; i < data.length; i += 4) {
                                        data[i] = Math.min(255, Math.max(0, (data[i] * brightnessFactor * contrastFactor) + contrastOffset));
                                        data[i + 1] = Math.min(255, Math.max(0, (data[i + 1] * brightnessFactor * contrastFactor) + contrastOffset));
                                        data[i + 2] = Math.min(255, Math.max(0, (data[i + 2] * brightnessFactor * contrastFactor) + contrastOffset));
                                    }
                                } else {
                                    const contrastFactor = 1.15;
                                    const contrastOffset = 128 * (1 - contrastFactor);

                                    for (let i = 0; i < data.length; i += 4) {
                                        data[i] = Math.min(255, Math.max(0, (data[i] * contrastFactor) + contrastOffset));
                                        data[i + 1] = Math.min(255, Math.max(0, (data[i + 1] * contrastFactor) + contrastOffset));
                                        data[i + 2] = Math.min(255, Math.max(0, (data[i + 2] * contrastFactor) + contrastOffset));
                                    }
                                }

                                ctx.putImageData(imageData, 0, 0);
                            }

                            const blob = await new Promise((resolve) => {
                                canvas.toBlob((result) => resolve(result), "image/jpeg", jpegQuality);
                            });

                            if (!blob || !blob.size) return rawFile;
                            const baseName = String(rawFile.name || "photo").replace(/\.[^/.]+$/, "");
                            return new File([blob], `${baseName}_enhanced.jpg`, {
                                type: "image/jpeg",
                                lastModified: Date.now()
                            });
                        } catch (_error) {
                            return rawFile;
                        }
                    }

                    async function uploadToCloudinaryWithRetry(cloudName, formData, maxAttempts = 3) {
                        let lastError = null;
                        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
                            const controller = new AbortController();
                            const timeoutId = setTimeout(() => controller.abort(), 90000);
                            try {
                                const uploadResp = await fetch(
                                    `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`,
                                    { method: "POST", body: formData, signal: controller.signal }
                                );

                                const uploadData = await uploadResp.json().catch(() => ({}));
                                if (!uploadResp.ok) {
                                    const cloudErr = String(uploadData?.error?.message || "").trim();
                                    throw new Error(
                                        cloudErr
                                            ? `Upload fejlede (${uploadResp.status}): ${cloudErr}`
                                            : `Upload fejlede (${uploadResp.status})`
                                    );
                                }

                                return uploadData;
                            } catch (error) {
                                const isAbort = String(error?.name || "") === "AbortError";
                                const errorText = String(error?.message || "").toLowerCase();
                                const isNetwork = isAbort || errorText.includes("network") || errorText.includes("failed to fetch") || errorText.includes("load failed") || errorText.includes("timeout");
                                const canRetry = attempt < maxAttempts && isNetwork;
                                if (!canRetry) {
                                    lastError = isAbort ? new Error("Upload timeout - forbindelsen er for langsom.") : error;
                                    break;
                                }
                                await new Promise((resolve) => setTimeout(resolve, 1200 * attempt));
                            } finally {
                                clearTimeout(timeoutId);
                            }
                        }

                        throw lastError || new Error("Upload fejlede.");
                    }

                    const origLabel = cameraButton.textContent;
                    cameraButton.disabled = true;
                    cameraButton.textContent = "Uploader...";

                    try {
                        const sigResult = await getCloudinarySignatureCallable({
                            companyId: SETTINGS.companyId,
                            locationId: SETTINGS.locationId,
                            moduleType: "Egenkontrol",
                            itemId: task?.equipmentName || task?.title || task?.taskId || instanceId,
                            taskInstanceId: instanceId,
                            taskId: task?.taskId || ""
                        });
                        const {
                            cloudName,
                            apiKey,
                            timestamp,
                            signature,
                            folder,
                            publicId,
                            tags,
                            context,
                            moduleType,
                            itemId,
                            userId
                        } = sigResult.data;

                        const uploadFile = await optimizeImageForUpload(file);
                        const formData = new FormData();
                        formData.append("file", uploadFile);
                        formData.append("api_key", apiKey);
                        formData.append("timestamp", String(timestamp));
                        formData.append("signature", signature);
                        formData.append("folder", folder);
                        formData.append("public_id", publicId);
                        formData.append("tags", tags);
                        formData.append("context", context);

                        const uploadData = await uploadToCloudinaryWithRetry(cloudName, formData);
                        const photoUrl = String(uploadData.secure_url || "");
                        const publicIdFromUpload = String(uploadData.public_id || publicId || "");
                        const transformedUrl = photoUrl.includes("/upload/")
                            ? photoUrl.replace("/upload/", "/upload/e_improve,e_sharpen,f_auto,q_auto/")
                            : photoUrl;
                        if (!photoUrl) throw new Error("Intet URL returneret fra Cloudinary.");

                        await setDoc(doc(db, "task_instances", instanceId), {
                            photoUrls: arrayUnion(photoUrl),
                            cloudinaryAssets: arrayUnion({
                                secureUrl: photoUrl,
                                optimizedUrl: transformedUrl,
                                publicId: publicIdFromUpload,
                                moduleType: moduleType || "Egenkontrol",
                                itemId: itemId || task?.title || task?.taskId || instanceId,
                                userId: userId || SETTINGS.createdBy,
                                taskId: task?.taskId || "",
                                taskInstanceId: instanceId,
                                createdAtClient: new Date().toISOString()
                            }),
                            lastPhotoAt: serverTimestamp()
                        }, { merge: true });

                        let mediaAssetRef = null;
                        try {
                            mediaAssetRef = await addDoc(collection(db, "media_assets"), {
                                userId: SETTINGS.createdBy,
                                companyId: SETTINGS.companyId,
                                organizationId: SETTINGS.companyId,
                                locationId: SETTINGS.locationId,
                                moduleType: moduleType || "Egenkontrol",
                                itemId: itemId || task?.title || task?.taskId || instanceId,
                                secureUrl: photoUrl,
                                optimizedUrl: transformedUrl,
                                publicId: publicIdFromUpload,
                                cloudinaryAssetId: String(uploadData.asset_id || ""),
                                bytes: Number(uploadData.bytes || 0),
                                width: Number(uploadData.width || 0),
                                height: Number(uploadData.height || 0),
                                format: String(uploadData.format || ""),
                                resourceType: String(uploadData.resource_type || "image"),
                                taskId: task?.taskId || "",
                                taskInstanceId: instanceId,
                                sourceCollection: "task_instances",
                                sourceDocId: instanceId,
                                createdByName: SETTINGS.currentUserName || SETTINGS.employeeName || SETTINGS.createdBy,
                                createdAt: serverTimestamp(),
                                createdAtClient: new Date().toISOString()
                            });
                        } catch (mediaError) {
                            console.warn("Kunne ikke gemme media_assets-post, men foto er gemt på task:", mediaError);
                        }

                        try {
                            const taskText = [task?.title, task?.description, task?.category]
                                .map((value) => String(value || "").toLowerCase())
                                .join(" ");
                            const inferredContextType =
                                taskText.includes("dysfagi") || taskText.includes("anret") || taskText.includes("blended")
                                    ? "institution"
                                    : "commercial";

                            const analyzeResp = await analyzeCloudinaryAssetCallable({
                                companyId: SETTINGS.companyId,
                                locationId: SETTINGS.locationId,
                                imageUrl: photoUrl,
                                moduleType: "egenkontrol",
                                itemId: itemId || task?.equipmentName || task?.title || task?.taskId || instanceId,
                                contextType: inferredContextType,
                                taskTitle: task?.title || ""
                            });

                            const aiResult = analyzeResp?.data?.result || null;
                            const routing = analyzeResp?.data?.routing || null;
                            const isRelevant = aiResult && (
                                String(aiResult.kategori || "").toLowerCase() === "egenkontrol" &&
                                String(aiResult.image_clarity || "").toLowerCase() !== "unclear" &&
                                Number(aiResult.confidence || 0) >= 0.4
                            );

                            if (aiResult && !isRelevant) {
                                // IMAGE REJECTED - Not relevant for egenkontrol
                                const actionEl = cameraButton.closest(".task-action");
                                if (actionEl) {
                                    let rejectionCard = actionEl.querySelector(".task-ai-rejection");
                                    if (!rejectionCard) {
                                        rejectionCard = document.createElement("div");
                                        rejectionCard.className = "task-ai-rejection";
                                        rejectionCard.style.cssText = "margin-top:8px;padding:12px;border:1px solid #f5c6cb;border-radius:10px;background:#f8d7da;";
                                        actionEl.appendChild(rejectionCard);
                                    }

                                    const kategori = String(aiResult.kategori || "").toLowerCase();
                                    const isUnclear = String(aiResult.image_clarity || "").toLowerCase() === "unclear";
                                    const confidence = Number(aiResult.confidence || 0);

                                    let rejectionMessage = "Billedet blev ikke genkendt som dokumentation.";
                                    if (isUnclear || confidence < 0.4) {
                                        rejectionMessage = "Billedet er for utydeligt til dokumentation.";
                                    } else if (kategori === "finance") {
                                        rejectionMessage = "Dette ser ud til at være en faktura - brug Finance modulet i stedet.";
                                    } else if (kategori === "institution") {
                                        rejectionMessage = "Dette ser ud til at være madanretning - brug Institution modulet i stedet.";
                                    }

                                    rejectionCard.innerHTML = `
                                        <div style="display:flex;gap:10px;align-items:flex-start;">
                                            <span style="font-size:24px;">⚠️</span>
                                            <div style="flex:1;min-width:0;">
                                                <div style="font-weight:700;font-size:13px;color:#721c24;margin-bottom:4px;">Billede afvist</div>
                                                <div style="font-size:12px;line-height:1.45;color:#721c24;margin-bottom:8px;">${rejectionMessage} Prøv at tage et tydeligere foto af din maskine eller udstyr.</div>
                                                <button type="button" class="btn btn-primary" data-retry-camera="${escapeHtml(instanceId)}" style="min-height:32px;padding:6px 12px;font-size:12px;">📸 Prøv igen</button>
                                            </div>
                                        </div>
                                    `;

                                    const retryBtn = rejectionCard.querySelector(`[data-retry-camera="${instanceId}"]`);
                                    if (retryBtn) {
                                        retryBtn.addEventListener("click", () => {
                                            rejectionCard.remove();
                                            cameraButton.textContent = origLabel;
                                            cameraButton.disabled = false;
                                            cameraButton.click();
                                        });
                                    }
                                }

                                // Save to temporary log only (media_assets with rejected flag)
                                if (mediaAssetRef) {
                                    await updateDoc(mediaAssetRef, {
                                        rejected: true,
                                        rejectionReason: routing?.user_message || "Ikke relevant for egenkontrol",
                                        aiSuggestion: {
                                            handling_udfort: false,
                                            beskrivelse: String(aiResult.beskrivelse || ""),
                                            confidence: Number(aiResult.confidence || 0),
                                            kategori: String(aiResult.kategori || "")
                                        },
                                        aiModel: String(analyzeResp?.data?.model || ""),
                                        analyzedAt: serverTimestamp()
                                    });
                                }

                                cameraButton.textContent = "⚠️ Afvist";
                                cameraButton.style.backgroundColor = "#f8d7da";
                                cameraButton.style.color = "#721c24";
                                return;
                            }

                            if (aiResult && isRelevant) {
                                // CRITICAL CONTROL: Check for deviations
                                const beskrivelse = String(aiResult.beskrivelse || "").toLowerCase();
                                const hasDeviationFlag = beskrivelse.startsWith("[afvigelse]");
                                const criticalKeywords = ["madrester", "beskidt", "rengøring nødvendig", "temperatur for høj", "snavs", "fedt", "urenheder"];
                                const hasCriticalIssue = hasDeviationFlag || criticalKeywords.some(keyword => beskrivelse.includes(keyword));

                                if (hasCriticalIssue) {
                                    // DEVIATION DETECTED - Require re-cleaning
                                    const actionEl = cameraButton.closest(".task-action");
                                    if (actionEl) {
                                        let deviationCard = actionEl.querySelector(".task-ai-deviation");
                                        if (!deviationCard) {
                                            deviationCard = document.createElement("div");
                                            deviationCard.className = "task-ai-deviation";
                                            deviationCard.style.cssText = "margin-top:8px;padding:12px;border:2px solid #dc3545;border-radius:10px;background:#fff5f5;";
                                            actionEl.appendChild(deviationCard);
                                        }

                                        deviationCard.innerHTML = `
                                            <div style="display:flex;gap:10px;align-items:flex-start;">
                                                <span style="font-size:28px;">🚨</span>
                                                <div style="flex:1;min-width:0;">
                                                    <div style="font-weight:800;font-size:14px;color:#dc3545;margin-bottom:6px;">AFVIGELSE FUNDET</div>
                                                    <div style="font-size:13px;line-height:1.5;color:#721c24;margin-bottom:10px;font-weight:600;">${escapeHtml(aiResult.beskrivelse || "")}</div>
                                                    <div style="font-size:12px;line-height:1.45;color:#856404;background:#fff3cd;padding:8px;border-radius:6px;margin-bottom:10px;border-left:3px solid #ffc107;">
                                                        ⚠️ <strong>Krav om gen-rengøring:</strong> Du skal rengøre og tage et NYT billede, hvor AI'en bekræfter at problemet er løst, før opgaven kan lukkes.
                                                    </div>
                                                    <div style="display:flex;gap:8px;flex-wrap:wrap;">
                                                        <button type="button" class="btn btn-danger" data-recleaning-camera="${escapeHtml(instanceId)}" style="min-height:36px;padding:8px 14px;font-size:13px;font-weight:700;">🧹 Rengør og tag nyt foto</button>
                                                        <button type="button" class="btn btn-secondary" data-show-override="${escapeHtml(instanceId)}" style="min-height:36px;padding:8px 14px;font-size:13px;">👨‍🍳 Overstyr med faglig begrundelse</button>
                                                    </div>
                                                    <div class="ai-override-form" data-override-form="${escapeHtml(instanceId)}" style="display:none;margin-top:12px;padding:12px;background:#f8f9fa;border-radius:8px;border:1px solid #dee2e6;">
                                                        <div style="font-weight:700;font-size:13px;color:#495057;margin-bottom:8px;">Faglig begrundelse for at overstyre AI</div>
                                                        <textarea 
                                                            data-override-justification="${escapeHtml(instanceId)}"
                                                            placeholder="Forklar hvorfor dette er fagligt acceptabelt (f.eks. 'Misfarvning i stål, ikke snavs' eller 'Normal driftsslid på pakning, ikke hygiejnerisiko')"
                                                            style="width:100%;min-height:80px;padding:8px;border:1px solid #ced4da;border-radius:6px;font-size:13px;resize:vertical;"
                                                        ></textarea>
                                                        <div style="display:flex;gap:8px;margin-top:8px;">
                                                            <button type="button" class="btn btn-primary" data-confirm-override="${escapeHtml(instanceId)}" style="min-height:32px;padding:6px 12px;font-size:12px;">✓ Bekræft faglig vurdering</button>
                                                            <button type="button" class="btn btn-ghost" data-cancel-override="${escapeHtml(instanceId)}" style="min-height:32px;padding:6px 12px;font-size:12px;">Annuller</button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        `;

                                        const recleanBtn = deviationCard.querySelector(`[data-recleaning-camera="${instanceId}"]`);
                                        if (recleanBtn) {
                                            recleanBtn.addEventListener("click", () => {
                                                cameraButton.textContent = origLabel;
                                                cameraButton.disabled = false;
                                                cameraButton.click();
                                            });
                                        }

                                        // MANUAL OVERRIDE FUNCTIONALITY
                                        const showOverrideBtn = deviationCard.querySelector(`[data-show-override="${instanceId}"]`);
                                        const overrideForm = deviationCard.querySelector(`[data-override-form="${instanceId}"]`);
                                        const confirmOverrideBtn = deviationCard.querySelector(`[data-confirm-override="${instanceId}"]`);
                                        const cancelOverrideBtn = deviationCard.querySelector(`[data-cancel-override="${instanceId}"]`);
                                        const justificationTextarea = deviationCard.querySelector(`[data-override-justification="${instanceId}"]`);

                                        if (showOverrideBtn && overrideForm) {
                                            showOverrideBtn.addEventListener("click", () => {
                                                overrideForm.style.display = "block";
                                                showOverrideBtn.style.display = "none";
                                                if (justificationTextarea) justificationTextarea.focus();
                                            });
                                        }

                                        if (cancelOverrideBtn && overrideForm && showOverrideBtn) {
                                            cancelOverrideBtn.addEventListener("click", () => {
                                                overrideForm.style.display = "none";
                                                showOverrideBtn.style.display = "inline-block";
                                                if (justificationTextarea) justificationTextarea.value = "";
                                            });
                                        }

                                        if (confirmOverrideBtn && justificationTextarea) {
                                            confirmOverrideBtn.addEventListener("click", async () => {
                                                const justification = justificationTextarea.value.trim();
                                                if (!justification) {
                                                    alert("Du skal skrive en faglig begrundelse for at overstyre AI'ens vurdering.");
                                                    return;
                                                }

                                                confirmOverrideBtn.disabled = true;
                                                confirmOverrideBtn.textContent = "Gemmer...";

                                                try {
                                                    // Save override to task instance
                                                    await setDoc(doc(db, "task_instances", instanceId), {
                                                        aiOverride: {
                                                            overridden: true,
                                                            justification: justification,
                                                            originalAiResult: aiResult.beskrivelse || "",
                                                            overriddenBy: SETTINGS.createdBy,
                                                            overriddenByName: SETTINGS.currentUserName || SETTINGS.employeeName || "Ukendt",
                                                            overriddenAt: serverTimestamp(),
                                                            overriddenAtClient: new Date().toISOString()
                                                        },
                                                        professionalOverride: true,
                                                        overrideJustification: justification
                                                    }, { merge: true });

                                                    // Update media asset with override
                                                    if (mediaAssetRef) {
                                                        await updateDoc(mediaAssetRef, {
                                                            professionalOverride: true,
                                                            overrideJustification: justification,
                                                            overriddenBy: SETTINGS.createdBy,
                                                            overriddenAt: serverTimestamp()
                                                        });
                                                    }

                                                    // Replace deviation card with success message
                                                    deviationCard.style.cssText = "margin-top:8px;padding:12px;border:2px solid #28a745;border-radius:10px;background:#f0fff4;";
                                                    deviationCard.innerHTML = `
                                                        <div style="display:flex;gap:10px;align-items:flex-start;">
                                                            <span style="font-size:28px;">👨‍🍳</span>
                                                            <div style="flex:1;min-width:0;">
                                                                <div style="font-weight:800;font-size:14px;color:#28a745;margin-bottom:6px;">FAGLIG VURDERING GODKENDT</div>
                                                                <div style="font-size:12px;line-height:1.5;color:#155724;margin-bottom:8px;">
                                                                    <strong>AI's vurdering:</strong> ${escapeHtml(aiResult.beskrivelse || "")}<br>
                                                                    <strong>Faglig begrundelse:</strong> ${escapeHtml(justification)}
                                                                </div>
                                                                <div style="font-size:11px;color:#6c757d;">
                                                                    Overstyrret af: ${escapeHtml(SETTINGS.currentUserName || "Dig")} • ${new Date().toLocaleString("da-DK")}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    `;

                                                    // Auto-fill comment with override justification
                                                    const commentInput = document.querySelector(`[data-instance-id="${CSS.escape(instanceId)}"][data-field="comment"]`);
                                                    if (commentInput) {
                                                        commentInput.value = `Faglig vurdering: ${justification}`;
                                                        commentInput.dispatchEvent(new Event("input", { bubbles: true }));
                                                    }

                                                } catch (error) {
                                                    console.error("Fejl ved gemning af override:", error);
                                                    alert("Der opstod en fejl ved gemning af din faglige vurdering. Prøv igen.");
                                                    confirmOverrideBtn.disabled = false;
                                                    confirmOverrideBtn.textContent = "✓ Bekræft faglig vurdering";
                                                }
                                            });
                                        }
                                    }

                                    // AUTO-CREATE DEVIATION RECORD
                                    const deviationId = `dev_${instanceId}_${Date.now()}`;
                                    const measurementInput = document.querySelector(`[data-instance-id="${CSS.escape(instanceId)}"][data-field="measurement"]`);
                                    const actualMeasurement = measurementInput ? measurementInput.value : null;

                                    await setDoc(doc(db, "deviations", deviationId), {
                                        deviationId,
                                        routineId: instanceId,
                                        taskId: task?.taskId || "",
                                        taskTitle: task?.title || "",
                                        equipmentName: task?.equipmentName || "",
                                        areaName: task?.areaName || "",
                                        companyId: SETTINGS.companyId,
                                        organizationId: SETTINGS.companyId,
                                        locationId: SETTINGS.locationId,
                                        userId: SETTINGS.createdBy,
                                        status: "open",
                                        severity: "critical",
                                        deviationType: "ai_detected_failure",
                                        beforeImage: {
                                            imageUrl: photoUrl,
                                            optimizedUrl: transformedUrl,
                                            aiDescription: String(aiResult.beskrivelse || ""),
                                            aiConfidence: Number(aiResult.confidence || 0),
                                            detectedAt: new Date().toISOString(),
                                            timestamp: serverTimestamp()
                                        },
                                        afterImage: null,
                                        actualMeasurement: actualMeasurement,
                                        measurementUnit: task?.unit || "°C",
                                        expectedLimit: task?.maxLimit || task?.minLimit || null,
                                        aiAnalysis: {
                                            beskrivelse: String(aiResult.beskrivelse || ""),
                                            confidence: Number(aiResult.confidence || 0),
                                            kategori: String(aiResult.kategori || "egenkontrol"),
                                            temperature_value: aiResult.temperature_value,
                                            has_fresh_fish: aiResult.has_fresh_fish
                                        },
                                        correctiveActionRequired: true,
                                        correctiveActionTaken: false,
                                        correctiveActionDescription: null,
                                        resolvedAt: null,
                                        resolvedBy: null,
                                        createdAt: serverTimestamp(),
                                        updatedAt: serverTimestamp()
                                    });

                                    // Mark task as requiring re-cleaning
                                    await setDoc(doc(db, "task_instances", instanceId), {
                                        requiresRecleaning: true,
                                        deviationId: deviationId,
                                        deviationDetectedAt: serverTimestamp(),
                                        deviationImages: arrayUnion({
                                            imageUrl: photoUrl,
                                            optimizedUrl: transformedUrl,
                                            aiDescription: String(aiResult.beskrivelse || ""),
                                            detectedAt: new Date().toISOString(),
                                            status: "deviation_found"
                                        }),
                                        lastAiSuggestion: {
                                            handling_udfort: false,
                                            beskrivelse: String(aiResult.beskrivelse || ""),
                                            confidence: Number(aiResult.confidence || 0),
                                            kategori: String(aiResult.kategori || "egenkontrol"),
                                            hasDeviation: true
                                        },
                                        aiUpdatedAt: serverTimestamp()
                                    }, { merge: true });

                                    if (mediaAssetRef) {
                                        await updateDoc(mediaAssetRef, {
                                            rejected: false,
                                            hasDeviation: true,
                                            deviationType: "critical_control_failure",
                                            aiSuggestion: {
                                                handling_udfort: false,
                                                beskrivelse: String(aiResult.beskrivelse || ""),
                                                confidence: Number(aiResult.confidence || 0),
                                                kategori: String(aiResult.kategori || "egenkontrol")
                                            },
                                            aiModel: String(analyzeResp?.data?.model || ""),
                                            analyzedAt: serverTimestamp()
                                        });
                                    }

                                    // Disable completion buttons
                                    const card = document.querySelector(`.task-item[data-instance-id="${CSS.escape(instanceId)}"]`);
                                    if (card) {
                                        const saveBtn = card.querySelector('[data-action="save"]');
                                        if (saveBtn) {
                                            saveBtn.disabled = true;
                                            saveBtn.style.opacity = "0.5";
                                            saveBtn.title = "Rengør først og tag nyt foto";
                                        }
                                    }

                                    cameraButton.textContent = "🚨 Afvigelse";
                                    cameraButton.style.backgroundColor = "#dc3545";
                                    cameraButton.style.color = "#fff";
                                    return;
                                }

                                // NO DEVIATION - Check if this is a re-cleaning approval
                                const taskDoc = await getDoc(doc(db, "task_instances", instanceId));
                                const taskData = taskDoc.data() || {};
                                const wasRequiringRecleaning = taskData.requiresRecleaning === true;

                                if (wasRequiringRecleaning) {
                                    // RE-CLEANING APPROVED - Update deviation record
                                    const deviationId = taskData.deviationId;
                                    const measurementInput = document.querySelector(`[data-instance-id="${CSS.escape(instanceId)}"][data-field="measurement"]`);
                                    const correctedMeasurement = measurementInput ? measurementInput.value : null;

                                    if (deviationId) {
                                        await setDoc(doc(db, "deviations", deviationId), {
                                            status: "resolved",
                                            afterImage: {
                                                imageUrl: photoUrl,
                                                optimizedUrl: transformedUrl,
                                                aiDescription: String(aiResult.beskrivelse || ""),
                                                aiConfidence: Number(aiResult.confidence || 0),
                                                detectedAt: new Date().toISOString(),
                                                timestamp: serverTimestamp()
                                            },
                                            correctedMeasurement: correctedMeasurement,
                                            correctiveActionTaken: true,
                                            correctiveActionDescription: String(aiResult.beskrivelse || ""),
                                            resolvedAt: serverTimestamp(),
                                            resolvedBy: SETTINGS.createdBy,
                                            resolutionTimeMinutes: taskData.deviationDetectedAt 
                                                ? Math.round((Date.now() - taskData.deviationDetectedAt.toMillis()) / 60000)
                                                : null,
                                            updatedAt: serverTimestamp()
                                        }, { merge: true });
                                    }

                                    const actionEl = cameraButton.closest(".task-action");
                                    if (actionEl) {
                                        const deviationCard = actionEl.querySelector(".task-ai-deviation");
                                        if (deviationCard) {
                                            deviationCard.innerHTML = `
                                                <div style="display:flex;gap:10px;align-items:flex-start;">
                                                    <span style="font-size:28px;">✅</span>
                                                    <div style="flex:1;min-width:0;">
                                                        <div style="font-weight:800;font-size:14px;color:#28a745;margin-bottom:6px;">AFVIGELSE LØST</div>
                                                        <div style="font-size:13px;line-height:1.5;color:#155724;margin-bottom:8px;font-weight:600;">${escapeHtml(aiResult.beskrivelse || "")}</div>
                                                        <div style="font-size:12px;line-height:1.45;color:#0c5460;background:#d1ecf1;padding:8px;border-radius:6px;border-left:3px solid #17a2b8;">
                                                            ✓ Før/efter billeder med tidsstempler gemmes i afvigelsesrapporten som dokumentation for korrektiv handling.
                                                        </div>
                                                    </div>
                                                </div>
                                            `;
                                        }
                                    }

                                    await setDoc(doc(db, "task_instances", instanceId), {
                                        requiresRecleaning: false,
                                        recleaningApprovedAt: serverTimestamp(),
                                        deviationImages: arrayUnion({
                                            imageUrl: photoUrl,
                                            optimizedUrl: transformedUrl,
                                            aiDescription: String(aiResult.beskrivelse || ""),
                                            detectedAt: new Date().toISOString(),
                                            status: "recleaning_approved"
                                        }),
                                        lastAiSuggestion: {
                                            handling_udfort: true,
                                            beskrivelse: String(aiResult.beskrivelse || ""),
                                            confidence: Number(aiResult.confidence || 0),
                                            kategori: String(aiResult.kategori || "egenkontrol"),
                                            hasDeviation: false
                                        },
                                        aiUpdatedAt: serverTimestamp()
                                    }, { merge: true });

                                    // Re-enable completion buttons
                                    const card = document.querySelector(`.task-item[data-instance-id="${CSS.escape(instanceId)}"]`);
                                    if (card) {
                                        const saveBtn = card.querySelector('[data-action="save"]');
                                        if (saveBtn) {
                                            saveBtn.disabled = false;
                                            saveBtn.style.opacity = "1";
                                            saveBtn.title = "";
                                        }
                                    }

                                    cameraButton.textContent = "✅ Godkendt";
                                    cameraButton.style.backgroundColor = "#28a745";
                                    cameraButton.style.color = "#fff";
                                } else {
                                    // NORMAL APPROVAL - No deviation
                                    aiSuggestionsByInstance.set(instanceId, {
                                        handlingUdfort: aiResult.handling_udfort === true,
                                        beskrivelse: String(aiResult.beskrivelse || "").trim(),
                                        confidence: Number(aiResult.confidence || 0),
                                        category: String(aiResult.kategori || "egenkontrol"),
                                        temperatureValue: aiResult.temperature_value,
                                        hasFreshFish: aiResult.has_fresh_fish
                                    });

                                    const commentInput = document.querySelector(`[data-instance-id="${CSS.escape(instanceId)}"][data-field="comment"]`);
                                    if (commentInput && aiResult.beskrivelse) {
                                        commentInput.value = String(aiResult.beskrivelse || "");
                                    }

                                    // AUTO-FILL TEMPERATURE MEASUREMENT
                                    if (aiResult.temperature_value !== null && aiResult.temperature_value !== undefined) {
                                        const measurementInput = document.querySelector(`[data-instance-id="${CSS.escape(instanceId)}"][data-field="measurement"]`);
                                        if (measurementInput) {
                                            const tempValue = Number(aiResult.temperature_value);
                                            measurementInput.value = tempValue.toFixed(1);

                                            // INTELLIGENT BOUNDARY VALIDATION
                                            const taskTitle = String(task?.title || "").toLowerCase();
                                            const taskDesc = String(task?.description || "").toLowerCase();
                                            const taskText = taskTitle + " " + taskDesc;
                                            
                                            const isFreezer = taskText.includes("frys") || taskText.includes("freezer");
                                            const isFridge = taskText.includes("køl") || taskText.includes("fridge") || taskText.includes("køleskab");
                                            const hasFreshFish = aiResult.has_fresh_fish === true;

                                            let isWithinBounds = true;
                                            let boundaryMessage = "";

                                            if (isFreezer) {
                                                // Freezer: must be <= -18°C
                                                if (tempValue > -18) {
                                                    isWithinBounds = false;
                                                    boundaryMessage = `Fryser temperatur for høj: ${tempValue}°C (skal være ≤ -18°C)`;
                                                }
                                            } else if (isFridge) {
                                                if (hasFreshFish) {
                                                    // Fresh fish: must be <= +2°C
                                                    if (tempValue > 2) {
                                                        isWithinBounds = false;
                                                        boundaryMessage = `Fersk fisk temperatur for høj: ${tempValue}°C (skal være ≤ +2°C)`;
                                                    }
                                                } else {
                                                    // Regular fridge: must be <= +5°C
                                                    if (tempValue > 5) {
                                                        isWithinBounds = false;
                                                        boundaryMessage = `Køleskab temperatur for høj: ${tempValue}°C (skal være ≤ +5°C)`;
                                                    }
                                                }
                                            }

                                            // COLOR-CODE MEASUREMENT FIELD
                                            if (isWithinBounds) {
                                                measurementInput.style.backgroundColor = "#d4edda";
                                                measurementInput.style.borderColor = "#28a745";
                                                measurementInput.style.color = "#155724";
                                            } else {
                                                measurementInput.style.backgroundColor = "#f8d7da";
                                                measurementInput.style.borderColor = "#dc3545";
                                                measurementInput.style.color = "#721c24";
                                            }

                                            // Show validation message
                                            const card = document.querySelector(`.task-item[data-instance-id="${CSS.escape(instanceId)}"]`);
                                            if (card && !isWithinBounds) {
                                                let tempWarning = card.querySelector(".temp-validation-warning");
                                                if (!tempWarning) {
                                                    tempWarning = document.createElement("div");
                                                    tempWarning.className = "temp-validation-warning";
                                                    tempWarning.style.cssText = "margin-top:8px;padding:8px;background:#fff3cd;border:1px solid #ffc107;border-radius:6px;font-size:12px;color:#856404;";
                                                    measurementInput.insertAdjacentElement("afterend", tempWarning);
                                                }
                                                tempWarning.innerHTML = `⚠️ <strong>${boundaryMessage}</strong> - Ret temperaturen eller dokumentér årsag i kommentarfeltet.`;
                                            }
                                        }
                                    }

                                    await setDoc(doc(db, "task_instances", instanceId), {
                                        lastAiSuggestion: {
                                            handling_udfort: aiResult.handling_udfort === true,
                                            beskrivelse: String(aiResult.beskrivelse || ""),
                                            confidence: Number(aiResult.confidence || 0),
                                            kategori: String(aiResult.kategori || "egenkontrol"),
                                            temperature_value: aiResult.temperature_value,
                                            has_fresh_fish: aiResult.has_fresh_fish
                                        },
                                        aiUpdatedAt: serverTimestamp()
                                    }, { merge: true });

                                    cameraButton.textContent = "✓ Foto gemt";
                                }

                                if (mediaAssetRef) {
                                    await updateDoc(mediaAssetRef, {
                                        rejected: false,
                                        hasDeviation: false,
                                        aiSuggestion: {
                                            handling_udfort: aiResult.handling_udfort === true,
                                            beskrivelse: String(aiResult.beskrivelse || ""),
                                            confidence: Number(aiResult.confidence || 0),
                                            kategori: String(aiResult.kategori || "egenkontrol")
                                        },
                                        aiModel: String(analyzeResp?.data?.model || ""),
                                        analyzedAt: serverTimestamp()
                                    });
                                }

                                const actionEl = cameraButton.closest(".task-action");
                                if (actionEl && !wasRequiringRecleaning) {
                                    renderAiPreviewCard(actionEl, {
                                        instanceId,
                                        imageUrl: transformedUrl,
                                        aiResult
                                    });
                                }
                            }
                        } catch (aiError) {
                            console.warn("AI-analyse fejlede, men billedet er gemt:", aiError);
                        }

                        const actionEl = cameraButton.closest(".task-action");
                        if (actionEl && !actionEl.querySelector(".task-photo-thumb")) {
                            const thumb = document.createElement("img");
                            thumb.src = transformedUrl;
                            thumb.alt = "Foto";
                            thumb.className = "task-photo-thumb";
                            thumb.style.cssText = "max-width:100%;max-height:120px;border-radius:8px;margin-top:8px;display:block;";
                            cameraButton.insertAdjacentElement("afterend", thumb);
                        }

                        cameraButton.textContent = "\u2713 Foto gemt";
                    } catch (err) {
                        console.error("Cloudinary upload fejl:", err);
                        cameraButton.textContent = origLabel;
                        cameraButton.disabled = false;
                        
                        // Detaljeret fejl-logning til mobil debugging
                        let errorDetails = {
                            message: String(err?.message || "Ukendt fejl"),
                            name: err?.name,
                            status: err?.status,
                            stack: err?.stack?.substring(0, 200)
                        };
                        
                        // Prøv at udtrække Cloudinary-fejl hvis muligt
                        if (err?.response && typeof err.response.json === "function") {
                            try {
                                const data = await err.response.json();
                                if (data?.error) errorDetails.cloudinaryError = data.error;
                            } catch {}
                        }
                        
                        // Vis detaljeret fejl på mobil
                        const debugInfo = JSON.stringify(errorDetails, null, 2);
                        console.error("Upload fejl detaljer:", debugInfo);
                        
                        const rawMessage = String(err?.message || "");
                        const userMessage = rawMessage.toLowerCase().includes("permission")
                            ? "Foto kunne ikke gemmes pga. adgangsfejl. Log ud/ind og prøv igen."
                            : rawMessage.toLowerCase().includes("network") || rawMessage.toLowerCase().includes("timeout")
                                ? "Foto upload fejlede pga. netværk/timeout. Tjek forbindelse og prøv igen."
                                : rawMessage
                                    ? `Foto upload fejlede: ${rawMessage}`
                                    : "Foto upload fejlede. Prøv igen.";
                        
                        alert(userMessage + "\n\nTeknisk info:\n" + debugInfo);
                    }
                });

                input.click();
                return;
            }

            const button = event.target.closest("button[data-action][data-instance-id]");
            if (!button) return;

            event.preventDefault();
            await handleTaskAction(button);
        });

        function inferMeasurementConfig(template) {
            const templateId = String(template?.id || "").toLowerCase();
            const title = String(template?.title || "").toLowerCase();
            const formType = String(template?.formType || "").toLowerCase();
            const controlPoint = String(template?.controlPoint || "").toLowerCase();

            const isTemperatureTask =
                formType === "temperature" ||
                templateId.includes("temp") ||
                title.includes("temperatur") ||
                controlPoint.includes("temperatur") ||
                controlPoint.includes("køle") ||
                controlPoint.includes("fryse") ||
                controlPoint.includes("varm");

            if (!isTemperatureTask) {
                return {
                    type: "check",
                    requiresMeasurement: false,
                    minValue: null,
                    maxValue: null,
                    measurementUnit: "",
                    equipmentType: ""
                };
            }

            let minValue = null;
            let maxValue = null;
            let equipmentType = "";

            if (templateId.includes("fridge") || title.includes("køleskab") || controlPoint.includes("køle")) {
                maxValue = 5;
                equipmentType = "fridge";
            } else if (templateId.includes("freezer") || title.includes("fryser") || controlPoint.includes("fryse")) {
                maxValue = -18;
                equipmentType = "freezer";
            } else if (templateId.includes("hot") || title.includes("varmhold")) {
                minValue = 65;
                equipmentType = "hot_holding";
            }

            return {
                type: equipmentType === "hot_holding" ? "process_temperature_check" : "temperature_check",
                requiresMeasurement: true,
                minValue,
                maxValue,
                measurementUnit: "C",
                equipmentType
            };
        }

        function buildGuideFromTemplate(template) {
            const controlPoint = template?.controlPoint || template?.title || "kontrolpunkt";
            const category = template?.category || "egenkontrol";
            const riskText =
                template?.riskLevel === "high"
                    ? "Høj risiko"
                    : template?.riskLevel === "medium"
                        ? "Mellem risiko"
                        : "Lav risiko";

            const steps = [];
            const approval = [];
            const ifNotOk = [];

            if (template?.formType === "temperature") {
                steps.push("Mål temperaturen med rent og egnet måleudstyr.");
                steps.push("Registrér den målte værdi i feltet.");
                steps.push("Tilføj kommentar hvis noget afviger eller kræver opmærksomhed.");
                approval.push("Temperaturen ligger inden for grænseværdien.");
                approval.push("Målingen er registreret korrekt.");
                ifNotOk.push("Markér afvigelsen eller manglende rengøring.");
                ifNotOk.push("Flyt varer eller stop brugen hvis fødevaresikkerheden er i tvivl.");
            } else {
                steps.push("Kontrollér området visuelt og fagligt.");
                steps.push("Skriv kommentar hvis der er behov for dokumentation.");
                steps.push("Markér rutinen som fuldført eller send den videre til opfølgning.");
                approval.push("Kontrolpunktet er udført efter virksomhedens rutine.");
                approval.push("Ingen forhold kræver korrigerende handling.");
                ifNotOk.push("Brug knappen til afvigelse eller manglende rengøring.");
                ifNotOk.push("Beskriv kort hvad der er fundet.");
            }

            return {
                guideEnabled: true,
                guideTitle: `${template?.title || "Rutine"} – guide`,
                guideIntro: `Denne rutine er automatisk oprettet ud fra risikoanalysen. Kontrolpunkt: ${controlPoint}. Kategori: ${category}. ${riskText}.`,
                guideAreas: [
                    `Kontrolpunkt: ${controlPoint}`,
                    `Kategori: ${category}`,
                    `Risikovurdering: ${riskText}`
                ],
                guideSteps: steps,
                guideApproval: approval,
                guideIfNotOk: ifNotOk
            };
        }

        function mapTemplateToTaskInstance(template, dateKey, index = 0) {
            const measurement = inferMeasurementConfig(template);
            const guide = buildGuideFromTemplate(template);

            let equipmentName = "";
            if (template?.id === "fridge-temp-daily") {
                equipmentName = "Køleskab";
            } else if (template?.id === "freezer-temp-daily") {
                equipmentName = "Fryser";
            } else if (template?.id === "hot-holding-check-daily") {
                equipmentName = "Varmholdning";
            } else if (template?.id === "cold-chain-check-daily") {
                equipmentName = "Kold kæde";
            } else if (template?.id === "receiving-control-daily") {
                equipmentName = "Varemodtagelse";
            } else if (template?.id === "cleaning-check-daily") {
                equipmentName = "Rengøring";
            } else if (template?.id === "closing-check-daily") {
                equipmentName = "Lukkerutine";
            } else if (template?.controlPoint) {
                equipmentName = template.controlPoint;
            }

            return {
                id: createInstanceIdFromTemplate(template.id || `task-${index + 1}`, dateKey, index),
                taskId: template.id || `task-${index + 1}`,
                companyId: SETTINGS.companyId,
                organizationId: SETTINGS.companyId,
                unitId: SETTINGS.unitId,
                locationId: SETTINGS.locationId,
                dateKey,
                title: template.title || "Rutine",
                description: template.description || "Automatisk oprettet rutine fra risikoanalyse",
                category: template.category || "egenkontrol",
                status: "pending",
                sourceType: "risk_analysis",
                sourceHazard: template.sourceHazard || "",
                linkedRiskIds: template.sourceHazard ? [template.sourceHazard] : [],
                frequency: template.frequency || "daily",
                riskLevel: template.riskLevel || "medium",
                formType: template.formType || "check",
                alertSeverityOnFailure: template.riskLevel === "high" ? "high" : "medium",
                equipmentId: template.id || "",
                equipmentName,
                equipmentType: measurement.equipmentType || "",
                type: measurement.type,
                requiresMeasurement: measurement.requiresMeasurement,
                measurementUnit: measurement.measurementUnit,
                minValue: measurement.minValue,
                maxValue: measurement.maxValue,
                createdBy: SETTINGS.createdBy,
                createdByName: SETTINGS.employeeName,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                completedAt: null,
                completedBy: "",
                completedByName: "",
                ...guide
            };
        }

        async function getExistingTodayTaskMap(dateKey) {
            let snapshot;

            try {
                const tasksQuery = query(
                    collection(db, "task_instances"),
                    where("companyId", "==", SETTINGS.companyId),
                    where("locationId", "==", SETTINGS.locationId),
                    where("dateKey", "==", dateKey)
                );
                snapshot = await getDocs(tasksQuery);
            } catch (error) {
                const tasksQueryLegacy = query(
                    collection(db, "task_instances"),
                    where("organizationId", "==", SETTINGS.companyId),
                    where("locationId", "==", SETTINGS.locationId),
                    where("dateKey", "==", dateKey)
                );
                snapshot = await getDocs(tasksQueryLegacy);
            }

            const existingByTaskId = new Map();
            const existingByDocId = new Map();

            snapshot.docs.forEach((docItem) => {
                const data = docItem.data();
                if (data?.taskId) {
                    existingByTaskId.set(String(data.taskId), docItem.id);
                }
                existingByDocId.set(docItem.id, true);
            });

            return {
                existingByTaskId,
                existingByDocId
            };
        }

        async function getOperatingOverride() {
            const tryQueries = [
                query(
                    collection(db, "operating_overrides"),
                    where("companyId", "==", SETTINGS.companyId),
                    where("locationId", "==", SETTINGS.locationId),
                    limit(1)
                ),
                query(
                    collection(db, "operating_overrides"),
                    where("organizationId", "==", SETTINGS.companyId),
                    where("locationId", "==", SETTINGS.locationId),
                    limit(1)
                )
            ];

            for (const q of tryQueries) {
                try {
                    const snapshot = await getDocs(q);
                    if (!snapshot.empty) {
                        const item = snapshot.docs[0];
                        return {
                            id: item.id,
                            ...item.data()
                        };
                    }
                } catch (error) {
                    if (String(error?.code || "") !== "permission-denied") {
                        console.warn("Operating override query fejlede:", error);
                    }
                }
            }

            return null;
        }

        function resolveOperatingState(data) {
            const todayKey = getTodayKey();

            if (!data || data.isActive === false) {
                return {
                    isOpen: true,
                    isClosed: false,
                    isVacation: false,
                    reason: "",
                    untilDateKey: null,
                    statusText: "Normal drift"
                };
            }

            const untilDateKey =
                normalizeDateKey(data.untilDateKey) ||
                normalizeDateKey(data.until) ||
                normalizeDateKey(data.endDate);

            const stillValid = !untilDateKey || todayKey <= untilDateKey;

            if (!stillValid) {
                return {
                    isOpen: true,
                    isClosed: false,
                    isVacation: false,
                    reason: "",
                    untilDateKey,
                    statusText: "Normal drift"
                };
            }

            const isClosed = data.closed === true;
            const isVacation = data.vacation === true;
            const isOpen = !isClosed && !isVacation;

            let statusText = "Normal drift";
            if (isClosed) statusText = "Lukket";
            if (isVacation) statusText = "Ferie";

            return {
                isOpen,
                isClosed,
                isVacation,
                reason: data.reason || "",
                untilDateKey,
                statusText
            };
        }

        async function loadOperatingState() {
            try {
                operatingOverride = await getOperatingOverride();
            } catch (error) {
                console.warn("Kunne ikke hente operating override, fortsætter med normal drift:", error);
                operatingOverride = null;
            }
            operatingState = resolveOperatingState(operatingOverride);
            applyOperatingStateToUi();
        }

        async function ensureTodayTasksExist() {
            // Rutiner skal afspejle backend-genererede dagsopgaver og ikke oprette
            // lokale fallback-kort, da det giver dubletter og omgår frekvenslogikken.
            return;
        }

        async function loadTasks() {
            const today = getTodayKey();

            let snapshot;

            try {
                const tasksQuery = query(
                    collection(db, "task_instances"),
                    where("companyId", "==", SETTINGS.companyId),
                    where("locationId", "==", SETTINGS.locationId),
                    where("dateKey", "==", today)
                );
                snapshot = await getDocs(tasksQuery);
            } catch (error) {
                const tasksQueryLegacy = query(
                    collection(db, "task_instances"),
                    where("organizationId", "==", SETTINGS.companyId),
                    where("locationId", "==", SETTINGS.locationId),
                    where("dateKey", "==", today)
                );
                snapshot = await getDocs(tasksQueryLegacy);
            }

            allTasks = snapshot.docs.map((docItem) => ({
                id: docItem.id,
                ...docItem.data()
            }));

            allTasks.sort((a, b) => {
                const getClosingRank = (task) => {
                    const haystack = [task?.taskId, task?.title, task?.category, task?.controlPoint]
                        .map((value) => String(value || "").toLowerCase())
                        .join(" ");
                    return haystack.includes("closing") || haystack.includes("lukker") ? 1 : 0;
                };

                const rankDelta = getClosingRank(a) - getClosingRank(b);
                if (rankDelta !== 0) return rankDelta;

                const titleA = (a.title || "").toLowerCase();
                const titleB = (b.title || "").toLowerCase();
                return titleA.localeCompare(titleB, "da");
            });

            await syncOverdueTasks();
        }

        async function loadAlerts() {
            if (operatingState.isClosed || operatingState.isVacation) {
                alertCount = 0;
                return;
            }

            try {
                let snapshot;

                try {
                    const alertsQuery = query(
                        collection(db, "alerts"),
                        where("companyId", "==", SETTINGS.companyId),
                        where("locationId", "==", SETTINGS.locationId),
                        where("dateKey", "==", getTodayKey()),
                        where("status", "==", "open")
                    );
                    snapshot = await getDocs(alertsQuery);
                } catch (error) {
                    const alertsQueryLegacy = query(
                        collection(db, "alerts"),
                        where("organizationId", "==", SETTINGS.companyId),
                        where("locationId", "==", SETTINGS.locationId),
                        where("dateKey", "==", getTodayKey()),
                        where("status", "==", "open")
                    );
                    snapshot = await getDocs(alertsQueryLegacy);
                }

                alertCount = snapshot.size;
            } catch (error) {
                console.warn("Kunne ikke hente afvigelser:", error);
                alertCount = 0;
            }
        }

        async function setOperatingMode(mode) {
            if (!userIsResponsible()) {
                alert("Kun ansvarlige brugere må ændre driftstatus.");
                return;
            }

            let reason = "";
            let untilDateKey = "";

            if (mode === "closed") {
                reason = window.prompt("Hvorfor er lokationen lukket?", operatingState.reason || "Lukket i dag") || "";
                untilDateKey = window.prompt("Gælder til dato (YYYY-MM-DD)?", getTodayKey()) || getTodayKey();
            }

            if (mode === "vacation") {
                reason = window.prompt("Hvad er ferie- eller pauseårsagen?", operatingState.reason || "Ferie") || "";
                untilDateKey = window.prompt("Gælder til dato (YYYY-MM-DD)?", getTodayKey()) || getTodayKey();
            }

            const payload = {
                companyId: SETTINGS.companyId,
                organizationId: SETTINGS.companyId,
                locationId: SETTINGS.locationId,
                updatedBy: SETTINGS.currentUserName,
                updatedAt: serverTimestamp()
            };

            if (mode === "open") {
                payload.isActive = false;
                payload.closed = false;
                payload.vacation = false;
                payload.reason = "";
                payload.untilDateKey = null;
            }

            if (mode === "closed") {
                payload.isActive = true;
                payload.closed = true;
                payload.vacation = false;
                payload.reason = reason.trim();
                payload.untilDateKey = normalizeDateKey(untilDateKey) || getTodayKey();
            }

            if (mode === "vacation") {
                payload.isActive = true;
                payload.closed = false;
                payload.vacation = true;
                payload.reason = reason.trim();
                payload.untilDateKey = normalizeDateKey(untilDateKey) || getTodayKey();
            }

            await setDoc(doc(db, "operating_overrides", getOverrideDocId()), payload, { merge: true });

            await loadPageData();
        }

        function bindOperatingButtons() {
            if (operatingButtonsBound) return;

            setOpenBtn?.addEventListener("click", () => setOperatingMode("open"));
            setClosedBtn?.addEventListener("click", () => setOperatingMode("closed"));
            setVacationBtn?.addEventListener("click", () => setOperatingMode("vacation"));

            setOpenBtnInline?.addEventListener("click", () => setOperatingMode("open"));
            setClosedBtnInline?.addEventListener("click", () => setOperatingMode("closed"));
            setVacationBtnInline?.addEventListener("click", () => setOperatingMode("vacation"));
            setDateBtn?.addEventListener("click", () => setReferenceDateFromPrompt());
            setDateBtnInline?.addEventListener("click", () => setReferenceDateFromPrompt());

            operatingButtonsBound = true;
        }

        async function loadPageData() {
            taskListEl.innerHTML = `<div class="loading-box">Henter dagens rutiner...</div>`;

            try {
                await loadOperatingState();
                try {
                    await ensureTodayTasksExist();
                } catch (error) {
                    console.warn("Kunne ikke auto-oprette dagens rutiner, fortsætter med eksisterende data:", error);
                }
                await loadTasks();
                await loadAlerts();

                renderTasks();
                updateKpis();
            } catch (error) {
                console.error("Fejl ved hentning:", error);
                taskListEl.innerHTML = `
                    <div class="error-box">
                        Kunne ikke hente dagens rutiner fra Firestore.
                    </div>
                `;
            }
        }

        setupAuthGate({
            appName: "Madkontrollen Pro",
            onAuthenticated: async ({ user, profile }) => {
                console.log('🚀 RUTINER onAuthenticated STARTED');
                console.log('   User:', user);
                console.log('   Profile:', profile);
                
                SETTINGS.createdBy = user.uid;
                SETTINGS.employeeName = String(
                    profile?.displayName || user.displayName || user.email || user.uid
                );
                SETTINGS.currentUserName = SETTINGS.employeeName;
                SETTINGS.currentUserRole = String(profile?.role || "employee").trim().toLowerCase();
                
                console.log('   Getting profile companyId and locations...');
                SETTINGS.currentUserCompanyId = getProfileCompanyId(profile);
                SETTINGS.currentUserLocations = normalizeLocationIds(profile);
                console.log('   currentUserCompanyId:', SETTINGS.currentUserCompanyId);
                console.log('   currentUserLocations:', SETTINGS.currentUserLocations);

                // Check for impersonation mode (super-admin viewing as another company)
                console.log('🔍 Rutiner - Tjekker impersonation mode');
                console.log('   isImpersonating():', isImpersonating());
                console.log('   sessionStorage mkp_impersonate_active:', sessionStorage.getItem('mkp_impersonate_active'));
                console.log('   sessionStorage mkp_impersonate_companyId:', sessionStorage.getItem('mkp_impersonate_companyId'));
                console.log('   sessionStorage mkp_impersonate_locationId:', sessionStorage.getItem('mkp_impersonate_locationId'));
                
                if (isImpersonating()) {
                    console.log('✅ I impersonation mode');
                    SETTINGS.companyId = getEffectiveCompanyId(SETTINGS.currentUserCompanyId);
                    SETTINGS.locationId = getEffectiveLocationId(SETTINGS.currentUserLocations[0]);
                    
                    console.log('   Effective companyId:', SETTINGS.companyId);
                    console.log('   Effective locationId:', SETTINGS.locationId);
                    
                    // Render impersonation banner
                    renderImpersonationBanner();
                } else {
                    console.log('❌ IKKE i impersonation mode - bruger egen profil');
                    SETTINGS.companyId = SETTINGS.currentUserCompanyId;
                    
                    const storedLocation = getStoredLocationId();
                    const firstAllowedLocation = SETTINGS.currentUserLocations[0] || "";
                    const selectedLocation = SETTINGS.currentUserLocations.includes(storedLocation)
                        ? storedLocation
                        : firstAllowedLocation;

                    SETTINGS.locationId = selectedLocation;
                    setStoredLocationId(selectedLocation);
                    
                    console.log('   User companyId:', SETTINGS.companyId);
                    console.log('   User locationId:', SETTINGS.locationId);
                }

                SETTINGS.companyLegacyId = toLegacyId(SETTINGS.companyId);
                SETTINGS.locationLegacyId = toLegacyId(SETTINGS.locationId);

                setLocationLabel();

                console.log('📊 Final SETTINGS:');
                console.log('   companyId:', SETTINGS.companyId);
                console.log('   locationId:', SETTINGS.locationId);

                if (!SETTINGS.companyId || !SETTINGS.locationId) {
                    console.error('❌ Mangler companyId eller locationId!');
                    taskListEl.innerHTML = `
                        <div class="error-box">
                            Brugerprofil mangler companyId eller locationId i users collection.
                            <br><br>
                            <strong>Debug:</strong><br>
                            companyId: ${SETTINGS.companyId || 'MANGLER'}<br>
                            locationId: ${SETTINGS.locationId || 'MANGLER'}<br>
                            Impersonating: ${isImpersonating() ? 'Ja' : 'Nej'}
                        </div>
                    `;
                    return;
                }

                bindOperatingButtons();
                bindOverviewNavigation();
                await loadPageData();
            },
            onSignedOut: async () => {
                selectedDateKey = null;
                allTasks = [];
                alertCount = 0;
                updateTodayLabel();
                updateKpis();

                if (taskListEl) {
                    taskListEl.innerHTML = `<div class="loading-box">Log ind for at se dagens rutiner.</div>`;
                }
            }
        });

        // DEBUG: Manual task generation function
        window.testGenerateTasks = async function() {
            try {
                const { getFunctions, httpsCallable } = await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-functions.js');
                
                const firebaseConfigModule = await import('/core/firebase-config.js');
                const app = firebaseConfigModule.app || firebaseConfigModule.default || firebaseConfigModule.firebaseApp;
                
                if (!app) {
                    throw new Error('Could not resolve Firebase app from /core/firebase-config.js');
                }
                
                const functions = getFunctions(app, 'europe-west1');
                const generateTaskInstancesNow = httpsCallable(functions, 'generateTaskInstancesNow');
                
                const locationId = SETTINGS.locationId;
                const dateKey = getTodayKey();
                
                console.log('🚀 Calling generateTaskInstancesNow with:', { dateKey, locationId });
                console.log('   companyId:', SETTINGS.companyId);
                
                const result = await generateTaskInstancesNow({ dateKey, locationId });
                
                console.log('✅ Generator Success:', result.data);
                console.log('   Created:', result.data.summary.createdCount);
                console.log('   Skipped:', result.data.summary.skippedCount);
                console.log('   Blocked:', result.data.summary.blockedCount);
                
                return result.data;
                
            } catch (error) {
                console.error('❌ Generator Error:', error);
                throw error;
            }
        };
    </script>

    <!-- Guide Library -->
    <script type="module">
        import { getGuideForTask } from '/modules/egenkontrol/guideLibrary.js?v=fix4';
        import { getGuideByKeyV2 } from '/modules/egenkontrol/guideLibrary-v2.js?v=fix4';
        
        console.log("guideLibrary import OK", {
            hasGetGuideForTask: typeof getGuideForTask === "function",
            hasGetGuideByKeyV2: typeof getGuideByKeyV2 === "function"
        });
        
        window.getGuideForTask = getGuideForTask;
        window.getGuideByKeyV2 = getGuideByKeyV2;
    </script>

    <!-- Process Instances -->
    <script src="/core/processInstances.js"></script>
    <script src="/modules/egenkontrol/process-dashboard.js"></script>
</body>
</html>





```
