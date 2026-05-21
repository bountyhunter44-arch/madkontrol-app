// /core/layout.js

import { auth, db } from "./firebase-config.js";
import { t } from "./i18n.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { resolvePrettyCompanyInfo } from "./prettyName.js";

const CORE_MODULE_KEY = "core";

function normalizeModuleList(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item || "").trim().toLowerCase())
    .filter(Boolean);
}

function buildDefaultEntitlements() {
  return {
    coreEnabled: true,
    addons: new Set(),
    organizationId: ""
  };
}

function getOrganizationIdFromProfile(profile) {
  if (!profile) return "";

  const candidates = [
    profile.organizationId,
    profile.companyId,
    profile.companyLegacyId
  ];

  for (const candidate of candidates) {
    const value = String(candidate || "").trim();
    if (value) return value;
  }

  return "";
}

async function waitForAuthUser(timeoutMs = 5000) {
  if (auth.currentUser) return auth.currentUser;

  return new Promise((resolve) => {
    let settled = false;

    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      unsubscribe();
      resolve(auth.currentUser || null);
    }, timeoutMs);

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      unsubscribe();
      resolve(user || null);
    });
  });
}

async function getCurrentUserProfile() {
  const user = auth.currentUser || await waitForAuthUser();
  if (!user) return null;

  try {
    const byUid = await getDoc(doc(db, "users", user.uid));
    if (byUid.exists()) {
      return {
        uid: user.uid,
        email: user.email || "",
        ...byUid.data()
      };
    }

    if (user.email) {
      const byEmail = query(
        collection(db, "users"),
        where("email", "==", user.email),
        limit(1)
      );
      const snap = await getDocs(byEmail);
      if (!snap.empty) {
        return {
          uid: user.uid,
          email: user.email || "",
          ...snap.docs[0].data()
        };
      }
    }
  } catch (error) {
    console.warn("Kunne ikke hente brugerprofil til layout:", error);
  }

  return {
    uid: user.uid,
    email: user.email || ""
  };
}

async function getModuleEntitlements() {
  const fallback = buildDefaultEntitlements();

  const profile = await getCurrentUserProfile();
  if (!profile) {
    return fallback;
  }

  const profileModules = normalizeModuleList(profile.modules || profile.addons || []);
  for (const moduleKey of profileModules) {
    fallback.addons.add(moduleKey);
  }

  const organizationId = getOrganizationIdFromProfile(profile);
  if (!organizationId) {
    return fallback;
  }

  fallback.organizationId = organizationId;

  try {
    const orgDoc = await getDoc(doc(db, "organizations", organizationId));
    if (orgDoc.exists()) {
      const data = orgDoc.data() || {};
      const addons = normalizeModuleList(data.addons || data.modules || []);

      return {
        coreEnabled: data.coreEnabled !== false,
        addons: new Set(addons),
        organizationId
      };
    }
  } catch (error) {
    console.warn("Kunne ikke hente modul-entitlements:", error);
  }

  return fallback;
}

function getCurrentPath() {
  return window.location.pathname || "/";
}

function isPathMatch(currentPath, targetPath) {
  if (!currentPath || !targetPath) return false;
  if (currentPath === targetPath) return true;
  return currentPath.endsWith(targetPath);
}

function getCompanyInfo() {
  return {
    companyName: "Madkontrollen Pro",
    logoSrc: "/images/logo.svg",
    logoAlt: "Madkontrollen Pro logo",

    // Contact info will be populated from user's company data
    addressLabel: "",
    addressValue: "",

    phoneLabel: "",
    phoneValue: "",

    cvrLabel: "",
    cvrValue: "",

    emailLabel: "",
    emailValue: ""
  };
}

function getNavItems() {
  return [
    {
      key: "dashboard",
      labelKey: "nav.dashboard",
      label: "Dashboard",
      short: "DB",
      href: "/dashboard",
      module: CORE_MODULE_KEY
    },
    {
      key: "rutiner",
      labelKey: "nav.rutiner",
      label: "Rutiner",
      short: "RU",
      href: "/modules/egenkontrol/rutiner.html",
      module: CORE_MODULE_KEY
    },
    {
      key: "afvigelser",
      labelKey: "nav.afvigelser",
      label: "Afvigelser",
      short: "AF",
      href: "/modules/egenkontrol/afvigelser.html",
      module: CORE_MODULE_KEY
    },
    {
      key: "risikoanalyse",
      labelKey: "nav.risikoanalyse",
      label: "Risikoanalyse",
      short: "RI",
      href: "/modules/egenkontrol/risikoanalyse.html",
      module: CORE_MODULE_KEY
    },
    {
      key: "rapporter",
      labelKey: "nav.rapporter",
      label: "Myndighedsrapport",
      short: "MR",
      href: "/modules/egenkontrol/rapporter.html?mode=authority",
      module: CORE_MODULE_KEY
    },
    {
      key: "billedarkiv",
      labelKey: "nav.billedarkiv",
      label: "Billedarkiv",
      short: "BA",
      href: "/modules/core/billed-arkiv.html",
      module: CORE_MODULE_KEY
    },
    {
      key: "seo",
      labelKey: "nav.seo",
      label: "SEO Generator",
      short: "SE",
      href: "/modules/seo/generator.html",
      module: CORE_MODULE_KEY
    },
    {
      key: "kontrol",
      labelKey: "nav.kontrol",
      label: "Kontrol-mode",
      short: "KM",
      href: "/kontrol.html",
      module: CORE_MODULE_KEY
    },
    {
      key: "drift",
      labelKey: "nav.drift",
      label: "Drift",
      short: "DR",
      href: "/modules/drift/menu.html",
      module: "drift"
    },
    {
      key: "akademi",
      labelKey: "nav.akademi",
      label: "Akademi",
      short: "AK",
      href: "/modules/akademi/akademi.html",
      module: "akademi"
    },
    {
      key: "kalkulation",
      labelKey: "nav.kalkulation",
      label: "Kalkulation",
      short: "KL",
      href: "/modules/kalkulation/index.html",
      module: "kalkulation"
    },
    {
      key: "sensorer",
      labelKey: "nav.sensorer",
      label: "Sensorer",
      short: "SN",
      href: "/modules/sensorer/index.html",
      module: "sensorer"
    },
    {
      key: "vedligehold",
      labelKey: "nav.vedligehold",
      label: "Vedligehold",
      short: "VH",
      href: "/modules/vedligehold/index.html",
      module: "vedligehold"
    },
    {
      key: "vandsystem",
      labelKey: "nav.vandsystem",
      label: "Vandsystem",
      short: "VS",
      href: "/modules/water/dashboard.html",
      module: "vandsystem"
    }
  ];
}

function isNavItemEnabled(item, entitlements) {
  if (!item?.module || item.module === CORE_MODULE_KEY) {
    return entitlements.coreEnabled !== false;
  }

  return entitlements.addons.has(String(item.module || "").toLowerCase());
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function createHeaderMarkup(lang = "da") {
  const info = getCompanyInfo();

  const logoMarkup = `
    <a href="/dashboard" class="brand mkp-layout-brand" aria-label="${escapeHtml(info.companyName)}">
      <img
        src="${escapeHtml(info.logoSrc)}"
        alt="${escapeHtml(info.logoAlt)}"
        class="brand-logo mkp-layout-brand-logo"
      />
    </a>
  `;

  const labelCompany = t("layout.label.company", lang) || "Virksomhed:";
  const labelAddress = t("layout.label.address", lang) || "Adresse:";
  const labelEmail = t("layout.label.email", lang) || "Email:";
  const labelPhone = t("layout.label.phone", lang) || "Tlf.:";

  return `
    <header class="topbar mkp-layout-topbar">
      <div class="container topbar-inner mkp-layout-topbar-inner">
        <div class="mkp-topbar-brand-row">
          ${logoMarkup}
          <div id="languageSwitcherContainer" class="mkp-topbar-lang"></div>
        </div>
        <div class="topbar-info mkp-layout-topbar-info">
          <div class="topbar-info-item">
            <strong>${labelCompany}</strong>
            <span id="mkpTopbarCompany">…</span>
          </div>
          <div class="topbar-info-item">
            <strong>${labelAddress}</strong>
            <span id="mkpTopbarAddress">…</span>
          </div>
          <div class="topbar-info-item">
            <strong>${labelEmail}</strong>
            <span id="mkpTopbarEmail">…</span>
          </div>
          <div class="topbar-info-item">
            <strong>${labelPhone}</strong>
            <span id="mkpTopbarPhone">…</span>
          </div>
        </div>
      </div>
    </header>
  `;
}

async function populateTopbarFromProfile() {
  try {
    const user = auth.currentUser || await waitForAuthUser();
    if (!user) return;

    const userProfile = await getCurrentUserProfile();
    const pretty = await resolvePrettyCompanyInfo({
      uid: user.uid,
      userData: userProfile || {}
    });

    console.log("[layout pretty names]", pretty);
    window.__mkpPrettyCompanyInfo = pretty;

    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val || "";
    };
    set("mkpTopbarCompany", pretty.displayCompany);
    set("mkpTopbarAddress", pretty.address);
    set("mkpTopbarEmail", pretty.contactEmail || "Ikke angivet");
    set("mkpTopbarPhone", pretty.phone);
  } catch (e) {
    console.warn("[layout] topbar populate failed:", e.message);
  }
}

function createSidebarMarkup(currentPath, entitlements, lang = "da") {
  const navItems = getNavItems().filter((item) => isNavItemEnabled(item, entitlements));

  const sidebarLinks = navItems.map((item) => {
    const activeClass = isPathMatch(currentPath, item.href) ? "active" : "";
    const label = (item.labelKey && t(item.labelKey, lang)) || item.label;

    return `
      <a href="${item.href}" class="sidebar-link ${activeClass}">
        <span class="sidebar-badge">${item.short}</span>
        <span>${label}</span>
      </a>
    `;
  }).join("");

  return `
    <aside class="sidebar mkp-layout-sidebar">
      <div class="sidebar-inner">
        <div class="sidebar-group">
          <div class="sidebar-label">Navigation</div>
          ${sidebarLinks}
        </div>
      </div>
    </aside>
  `;
}

function ensureLayoutStyles() {
  if (document.getElementById("mkp-layout-styles")) return;

  const style = document.createElement("style");
  style.id = "mkp-layout-styles";
  style.textContent = `
    .mkp-layout-topbar{
      position:sticky;
      top:0;
      z-index:100;
      backdrop-filter:blur(12px);
      background:rgba(245,248,244,0.94);
      border-bottom:1px solid rgba(217,228,217,0.95);
    }

    .mkp-layout-topbar-inner{
      min-height:98px;
      display:flex;
      flex-direction:column;
      justify-content:center;
      gap:6px;
      padding:12px 0;
    }

    .mkp-topbar-brand-row{
      display:flex;
      align-items:center;
      justify-content:space-between;
      width:100%;
    }

    .mkp-layout-brand{
      display:flex;
      align-items:center;
      justify-content:flex-start;
      text-decoration:none;
      color:inherit;
      min-width:0;
      flex:0 0 auto;
    }

    .mkp-layout-brand-logo{
      display:block;
      width:auto;
      max-width:300px;
      max-height:64px;
      object-fit:contain;
    }

    .mkp-layout-topbar-info{
      display:flex;
      flex-wrap:wrap;
      justify-content:flex-start;
      align-items:center;
      gap:10px 12px;
      min-width:0;
      width:100%;
    }

    .mkp-layout-topbar .topbar-info-item{
      display:inline-flex;
      align-items:center;
      gap:8px;
      min-height:38px;
      padding:8px 12px;
      border-radius:999px;
      background:#fff;
      border:1px solid #d9e4d9;
      box-shadow:0 8px 24px rgba(16,24,16,0.06);
      color:#182118;
      font-size:13px;
      font-weight:700;
      line-height:1.2;
      white-space:nowrap;
    }

    .mkp-layout-topbar .topbar-info-item strong{
      color:#1f5a23;
      font-weight:800;
    }

    .mkp-layout-topbar .topbar-info-item a{
      color:inherit;
      text-decoration:none;
    }

    .mkp-layout-sidebar{
      display:block;
      width:280px;
      flex:0 0 280px;
    }

    .mkp-layout-sidebar .sidebar-inner{
      display:flex;
      flex-direction:column;
      gap:14px;
    }

    .mkp-layout-sidebar .sidebar-group{
      display:flex;
      flex-direction:column;
      gap:6px;
    }

    .mkp-layout-sidebar .sidebar-label{
      font-size:11px;
      font-weight:800;
      color:#667267;
      text-transform:uppercase;
      letter-spacing:.08em;
      padding:0 4px 4px;
    }

    .mkp-layout-sidebar .sidebar-link{
      position:relative;
      display:flex;
      align-items:center;
      gap:12px;
      padding:12px 14px;
      border-radius:14px;
      font-weight:700;
      color:#667267;
      text-decoration:none;
      transition:all .2s ease;
    }

    .mkp-layout-sidebar .sidebar-link:hover,
    .mkp-layout-sidebar .sidebar-link.active{
      background:#f8fbf8;
      color:#182118;
    }

    .mkp-layout-sidebar .sidebar-link::before{
      content:"";
      position:absolute;
      left:0;
      top:8px;
      bottom:8px;
      width:4px;
      border-radius:999px;
      background:transparent;
      transition:all .2s ease;
    }

    .mkp-layout-sidebar .sidebar-link.active::before{
      background:linear-gradient(180deg,#2e7d32,#43a047);
      box-shadow:0 6px 16px rgba(46,125,50,0.22);
    }

    .mkp-layout-sidebar .sidebar-badge{
      width:34px;
      height:34px;
      min-width:34px;
      display:inline-flex;
      align-items:center;
      justify-content:center;
      border-radius:10px;
      background:#eef5ee;
      border:1px solid #d9e4d9;
      color:#2e7d32;
      font-size:12px;
      font-weight:900;
      letter-spacing:.04em;
      flex:0 0 auto;
      box-shadow:inset 0 1px 0 rgba(255,255,255,0.7);
    }

    .mkp-layout-sidebar .sidebar-link.active .sidebar-badge{
      background:linear-gradient(135deg,#2e7d32,#43a047);
      color:#fff;
      border-color:transparent;
      box-shadow:0 8px 18px rgba(46,125,50,0.18);
    }

    .mkp-topbar-lang{
      flex:0 0 auto;
      position:relative;
    }

    .mkp-topbar-lang .language-switcher{
      position:relative;
    }

    .mkp-topbar-lang .language-btn{
      display:inline-flex;
      align-items:center;
      gap:7px;
      min-height:38px;
      padding:7px 13px;
      border-radius:999px;
      background:#fff;
      border:1px solid #d9e4d9;
      box-shadow:0 8px 24px rgba(16,24,16,0.06);
      font-size:14px;
      font-weight:700;
      cursor:pointer;
      white-space:nowrap;
      color:#182118;
      transition:background .15s,border-color .15s;
    }

    .mkp-topbar-lang .language-btn:hover{
      background:#f2f8f2;
      border-color:#2e7d32;
    }

    .mkp-topbar-lang .language-flag{
      font-size:18px;
      line-height:1;
    }

    .mkp-topbar-lang .language-name{
      font-size:13px;
    }

    .mkp-topbar-lang .language-dropdown{
      position:absolute;
      right:0;
      top:calc(100% + 6px);
      background:#fff;
      border:1px solid #d9e4d9;
      border-radius:14px;
      padding:6px;
      min-width:170px;
      z-index:500;
      box-shadow:0 8px 28px rgba(0,0,0,.11);
    }

    .mkp-topbar-lang .language-option{
      display:flex;
      align-items:center;
      gap:9px;
      width:100%;
      padding:8px 10px;
      border:none;
      background:none;
      cursor:pointer;
      border-radius:9px;
      font-size:13px;
      font-weight:600;
      color:#182118;
      text-align:left;
    }

    .mkp-topbar-lang .language-option:hover,
    .mkp-topbar-lang .language-option.active{
      background:#f2f8f2;
    }

    @media (max-width:760px){
      .mkp-topbar-lang .language-name{ display:none; }
      .mkp-topbar-lang .language-btn{ padding:7px 10px; }
    }

    .mkp-layout-topbar .nav,
    .mkp-layout-topbar nav,
    .mkp-layout-topbar .topbar-nav,
    .mkp-layout-topbar .topbar-links,
    .mkp-layout-topbar .header-nav{
      display:none !important;
    }

    .mobile-app-nav{
      display:none !important;
    }

    @media (max-width: 1180px){
      .mkp-layout-sidebar{
        width:100%;
        flex:1 1 auto;
      }
    }

    @media (max-width: 900px){
      .mkp-layout-topbar{
        min-height:auto !important;
      }

      .mkp-layout-topbar-inner{
        min-height:auto !important;
        padding:8px 0 !important;
        gap:0 !important;
        flex-direction:row !important;
      }

      .mkp-layout-brand,
      .mkp-layout-brand-logo{
        display:none !important;
      }

      .mkp-layout-topbar-info{
        display:none !important;
      }

      .mkp-topbar-brand-row{
        justify-content:flex-end !important;
        width:100% !important;
      }

      .mkp-topbar-lang{
        display:flex !important;
      }
    }

    @media (max-width: 768px){
      .mkp-layout-sidebar,
      .mkp-layout-sidebar.sidebar{
        position:fixed !important;
        left:12px !important;
        right:12px !important;
        bottom:calc(10px + env(safe-area-inset-bottom, 0px)) !important;
        top:auto !important;
        z-index:160 !important;
        width:auto !important;
        border-radius:0 !important;
        padding:6px 0 !important;
        background:transparent !important;
        backdrop-filter:none !important;
        box-shadow:none !important;
        border:none !important;
        margin:0 !important;
      }

      .mkp-layout-sidebar .sidebar-inner{
        display:grid !important;
        grid-template-columns:repeat(auto-fit, minmax(58px, 1fr)) !important;
        gap:6px !important;
      }

      .mkp-layout-sidebar .sidebar-group{
        display:contents !important;
      }

      .mkp-layout-sidebar .sidebar-label,
      .mkp-layout-sidebar .sidebar-link::before{
        display:none !important;
      }

      .mkp-layout-sidebar .sidebar-link,
      .mkp-layout-sidebar .sidebar-link:hover,
      .mkp-layout-sidebar .sidebar-link.active{
        min-height:62px !important;
        min-width:0 !important;
        padding:8px 6px !important;
        border-radius:16px !important;
        display:flex !important;
        flex-direction:column !important;
        justify-content:center !important;
        align-items:center !important;
        gap:6px !important;
        text-align:center !important;
        font-size:10px !important;
        font-weight:800 !important;
        line-height:1.1 !important;
        background:transparent !important;
      }

      .mkp-layout-sidebar .sidebar-badge{
        width:28px !important;
        height:28px !important;
        min-width:28px !important;
        border-radius:9px !important;
        font-size:10px !important;
        margin:0 auto !important;
      }

      .mkp-layout-topbar{
        min-height:auto !important;
      }

      .mkp-layout-topbar-inner{
        min-height:auto !important;
        padding:8px 0 !important;
        gap:0 !important;
        flex-direction:row !important;
      }

      .mkp-layout-brand,
      .mkp-layout-brand-logo{
        display:none !important;
      }

      .mkp-layout-topbar-info{
        display:none !important;
      }

      .mkp-topbar-brand-row{
        justify-content:flex-end !important;
        width:100% !important;
      }

      .mkp-topbar-lang{
        display:flex !important;
      }

      .mkp-layout-topbar .btn,
      .mkp-layout-topbar button,
      .mkp-layout-topbar a.btn,
      .mkp-layout-topbar [class*="btn-"],
      .mkp-layout-topbar .topbar-alert,
      .mkp-layout-topbar .topbar-company,
      .mkp-layout-topbar .topbar-user,
      .mkp-layout-topbar .topbar-info-item{
        background:transparent !important;
        border-color:transparent !important;
        box-shadow:none !important;
      }
    }

    @media (max-width: 640px){
      .mkp-layout-topbar .topbar-info-item{
        width:100%;
        justify-content:flex-start;
        border-radius:14px;
        background:transparent;
        border:none;
        box-shadow:none;
        padding:4px 0;
      }

      .mkp-layout-topbar-info{
        flex-direction:column;
        align-items:stretch;
      }
    }
  `;

  document.head.appendChild(style);
}

function mountMarkup(selector, html) {
  const el = document.querySelector(selector);
  if (!el) return;
  el.innerHTML = html;
}

function removeLegacyMobileNav() {
  const existingMobileNav = document.querySelector(".mobile-app-nav");
  if (existingMobileNav) {
    existingMobileNav.remove();
  }
}

export async function loadLayout() {
  const currentPath = getCurrentPath();
  const entitlements = await getModuleEntitlements();
  const lang = localStorage.getItem("userLanguage") || "da";

  ensureLayoutStyles();
  removeLegacyMobileNav();

  mountMarkup("#headerMount", createHeaderMarkup(lang));
  mountMarkup("#sidebarMount", createSidebarMarkup(currentPath, entitlements, lang));

  // Populate topbar with real company data from live_user_profiles
  populateTopbarFromProfile();

  // Init language switcher in topbar
  try {
    const { initI18n } = await import("/core/i18n.js");
    await initI18n();
  } catch (e) {
    console.warn("[layout] i18n init failed:", e);
  }

  // Init persistent cooling overlay (shows on any page if a run is active)
  try {
    const { initCoolingOverlay } = await import("/core/cooling-overlay.js");
    initCoolingOverlay();
  } catch (err) {
    console.warn("[layout] cooling-overlay init feil:", err);
  }
}
