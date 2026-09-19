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
import { isImpersonating, getEffectiveCompanyId, getEffectiveLocationId, getImpersonatedCompanyName } from "./impersonation.js";

const CORE_MODULE_KEY = "core";

// Brugerstatus til drawerens bund. Sættes af populateDrawerFromProfile().
let drawerUserState = null;

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
    companyName: "EWCP Egenkontrol",
    logoSrc: "/images/ewcp-logo.svg",
    logoAlt: "EWCP Egenkontrol logo",

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
      short: "📊",
      href: "/dashboard",
      module: CORE_MODULE_KEY
    },
    {
      key: "rutiner",
      labelKey: "nav.rutiner",
      label: "Rutiner",
      short: "📋",
      href: "/modules/egenkontrol/rutiner.html",
      module: CORE_MODULE_KEY
    },
    {
      key: "afvigelser",
      labelKey: "nav.afvigelser",
      label: "Afvigelser",
      short: "🚨",
      href: "/modules/egenkontrol/afvigelser.html",
      module: CORE_MODULE_KEY
    },
    {
      key: "risikoanalyse",
      labelKey: "nav.risikoanalyse",
      label: "Risikoanalyse",
      short: "🛡️",
      href: "/modules/egenkontrol/risikoanalyse.html",
      module: CORE_MODULE_KEY
    },
    {
      key: "risikoanalyse-inspiration",
      label: "Inspiration til risikoanalyse",
      short: "💡",
      href: "/modules/egenkontrol/risikoanalyse-inspiration.html",
      module: CORE_MODULE_KEY
    },
    {
      key: "rapporter",
      labelKey: "nav.rapporter",
      label: "Myndighedsrapport",
      short: "📑",
      href: "/modules/egenkontrol/rapporter.html?mode=authority",
      module: CORE_MODULE_KEY
    },
    {
      key: "billedarkiv",
      labelKey: "nav.billedarkiv",
      label: "Billedarkiv",
      short: "🖼️",
      href: "/core/billed-arkiv.html",
      module: CORE_MODULE_KEY
    },
    {
      key: "kontrol",
      labelKey: "nav.kontrol",
      label: "Kontrol-mode",
      short: "🔎",
      href: "/kontrol.html",
      module: CORE_MODULE_KEY
    },
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

function cleanText(value) {
  return String(value || "").trim();
}

function formatEmailDisplayName(email) {
  const prefix = cleanText(email).split("@")[0];
  if (!prefix) return "";

  return prefix
    .replace(/[._-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

async function getLiveUserProfileByUid(uid) {
  const normalizedUid = cleanText(uid);
  if (!normalizedUid) return null;

  try {
    const snap = await getDoc(doc(db, "live_user_profiles", normalizedUid));
    return snap.exists() ? (snap.data() || {}) : null;
  } catch (error) {
    console.warn("[layout] kunne ikke hente live_user_profiles brugerprofil:", error);
    return null;
  }
}

async function resolveTopbarUserName({ user, profile } = {}) {
  const profileName = cleanText(profile?.displayName);
  if (profileName) return profileName;

  const liveProfile = await getLiveUserProfileByUid(user?.uid || profile?.uid);
  const liveName = cleanText(liveProfile?.displayName || liveProfile?.profile?.displayName);
  if (liveName) return liveName;

  const authName = cleanText(user?.displayName);
  if (authName) return authName;

  const emailName = formatEmailDisplayName(user?.email || profile?.email);
  if (emailName) return emailName;

  return "Bruger";
}

export function createHeaderMarkup(lang = "da") {
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

  return `
    <header class="topbar mkp-layout-topbar">
      <div class="container topbar-inner mkp-layout-topbar-inner">
        <button
          type="button"
          class="mkp-menu-btn"
          id="mkpMenuBtn"
          aria-label="Åbn menu"
          aria-expanded="false"
          aria-controls="mkpDrawer"
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <path d="M3 6h18M3 12h18M3 18h18"/>
          </svg>
        </button>

        ${logoMarkup}

        <div class="topbar-right mkp-layout-topbar-right">
          <div id="languageSwitcherContainer" class="mkp-topbar-lang"></div>
        </div>
      </div>
    </header>
  `;
}

async function populateDrawerFromProfile() {
  try {
    const user = auth.currentUser || await waitForAuthUser();
    if (!user) return;

    const userProfile = await getCurrentUserProfile();

    // "Se som kunde": når en admin impersonerer, skal company-headeren vise det VALGTE
    // kundeselskab — samme effektive companyId/locationId som dashboardet allerede bruger —
    // ikke adminens eget. Genbruger de eksisterende impersonation-helpers (ingen ny
    // sessionmodel, ingen hardkodning). Ved normal login er companyId/locationId tomme,
    // så resolvePrettyCompanyInfo udleder dem fra brugerens egen profil præcis som før.
    const impersonating = isImpersonating();
    const pretty = await resolvePrettyCompanyInfo({
      uid: user.uid,
      userData: userProfile || {},
      companyId: impersonating ? getEffectiveCompanyId("") : "",
      locationId: impersonating ? getEffectiveLocationId("") : ""
    });
    const userName = await resolveTopbarUserName({ user, profile: userProfile });

    console.log("[layout pretty names]", pretty);
    window.__mkpPrettyCompanyInfo = pretty;

    const companyLabel = pretty.displayCompany
      || pretty.companyName
      || (impersonating ? getImpersonatedCompanyName() : "")
      || "";

    drawerUserState = {
      userName,
      companyLabel,
      email: user.email || ""
    };
    return drawerUserState;
  } catch (e) {
    console.warn("[layout] drawer user populate failed:", e.message);
    return null;
  }
}

export function createDrawerUserBodyMarkup(state) {
  const signedIn = Boolean(state && state.userName);
  const name = signedIn ? escapeHtml(state.userName) : "Ikke logget ind";
  const email = signedIn ? escapeHtml(state.email || "Ikke angivet") : "Log ind for at se dine data";
  // Produktets faste virksomhedsnavn gentages ikke som "firma" i brugerområdet.
  const companyLabel = String(state?.companyLabel || "").trim();
  const showCompany = signedIn && companyLabel && companyLabel !== "EWCP Egenkontrol";
  const companyLine = showCompany
    ? `<p class="mkp-drawer-company">${escapeHtml(companyLabel)}</p>`
    : "";

  return `
    <div class="mkp-drawer-user" aria-label="Bruger">
      <div class="mkp-drawer-user-top">
        <span class="mkp-drawer-avatar" aria-hidden="true">${signedIn ? "👤" : "?"}</span>
        <div class="mkp-drawer-user-text">
          <p class="mkp-drawer-user-name" id="mkpDrawerUserName">${name}</p>
          <p class="mkp-drawer-user-email" id="mkpDrawerUserEmail">${email}</p>
          ${companyLine}
        </div>
      </div>
      ${createDrawerAuthMarkup(signedIn)}
    </div>
  `;
}

export function createDrawerMarkup(currentPath, entitlements, lang = "da") {
  const navItems = getNavItems().filter((item) => isNavItemEnabled(item, entitlements));

  const navLinks = navItems.map((item) => {
    const isActive = isPathMatch(currentPath, item.href);
    const label = (item.labelKey && t(item.labelKey, lang)) || item.label;

    return `
      <a
        href="${item.href}"
        class="mkp-drawer-link${isActive ? " is-active" : ""}"
        data-nav-key="${escapeHtml(item.key)}"
        ${isActive ? 'aria-current="page"' : ""}
      >
        <span class="mkp-drawer-link-icon" aria-hidden="true">${item.short}</span>
        <span class="mkp-drawer-link-label">${escapeHtml(label)}</span>
      </a>
    `;
  }).join("");

  return `
    <div class="mkp-drawer-overlay" id="mkpDrawerOverlay" hidden></div>

    <aside
      class="mkp-drawer"
      id="mkpDrawer"
      role="navigation"
      aria-label="Hovedmenu"
      aria-hidden="true"
      tabindex="-1"
      hidden
    >
      <div class="mkp-drawer-head">
        <span class="mkp-drawer-title">Menu</span>
        <button
          type="button"
          class="mkp-drawer-close"
          id="mkpDrawerClose"
          aria-label="Luk menu"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18"/>
          </svg>
        </button>
      </div>

      <nav class="mkp-drawer-nav" aria-label="Navigation">
        <p class="mkp-drawer-group-label">Egenkontrol</p>
        ${navLinks}
      </nav>

      <div id="mkpDrawerUserBody">
        ${createDrawerUserBodyMarkup(null)}
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
      min-height:64px;
      display:flex;
      flex-direction:row;
      align-items:center;
      gap:12px;
      padding:8px 0;
    }

    .mkp-menu-btn{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      width:44px;
      height:44px;
      min-width:44px;
      padding:0;
      border:1px solid #cbd7f4;
      border-radius:12px;
      background:#fff;
      color:#142044;
      cursor:pointer;
      flex:0 0 auto;
      box-shadow:0 4px 14px rgba(16,24,16,0.06);
      transition:background .15s,border-color .15s,color .15s;
    }

    .mkp-menu-btn:hover,
    .mkp-menu-btn:focus-visible{
      background:#eef3ff;
      border-color:#2f5fe0;
      color:#1f4fc9;
    }

    .mkp-menu-btn:focus-visible{
      outline:3px solid rgba(47,95,224,0.45);
      outline-offset:2px;
    }

    .mkp-layout-brand{
      display:flex;
      align-items:center;
      justify-content:flex-start;
      text-decoration:none;
      color:inherit;
      min-width:0;
      flex:0 1 auto;
    }

    .mkp-layout-brand-logo{
      display:block;
      width:auto;
      height:44px;
      max-width:280px;
      max-height:44px;
      object-fit:contain;
    }

    .mkp-layout-topbar-right{
      display:flex;
      align-items:center;
      gap:10px;
      margin-left:auto;
      flex:0 0 auto;
      min-width:0;
    }

    .mkp-layout-topbar .topbar-right{
      flex:0 0 auto;
      min-width:0;
    }

    /* Den gamle permanente sidebar er erstattet af drawer'en nedenfor.
       Mountet (#sidebarMount) er tomt og må ikke reservere bredde. */
    #sidebarMount{
      display:contents !important;
    }

    /* ---------- Drawer (samme mønster som regnskab.ewcp.dk) ---------- */

    html.mkp-drawer-open,
    body.mkp-drawer-open{
      overflow:hidden !important;
    }

    #mkpDrawerMount{
      display:contents !important;
    }

    .mkp-drawer-overlay{
      position:fixed;
      inset:0;
      z-index:1190;
      background:rgba(16,24,40,0.45);
      opacity:0;
      transition:opacity .25s ease;
    }

    .mkp-drawer-overlay[hidden]{
      display:none !important;
    }

    body.mkp-drawer-open .mkp-drawer-overlay{
      opacity:1;
    }

    .mkp-drawer{
      position:fixed;
      top:0;
      left:0;
      bottom:0;
      height:100vh;
      height:100dvh;
      width:300px;
      max-width:88vw;
      z-index:1200;
      display:flex;
      flex-direction:column;
      background:#fff;
      border-right:1px solid #d9e4d9;
      box-shadow:0 18px 50px rgba(16,24,40,0.22);
      transform:translateX(-102%);
      visibility:hidden;
      transition:transform .25s ease,visibility .25s ease;
      overscroll-behavior:contain;
      padding-top:env(safe-area-inset-top,0px);
      padding-right:env(safe-area-inset-right,0px);
      padding-bottom:env(safe-area-inset-bottom,0px);
    }

    .mkp-drawer[hidden]{
      display:none !important;
    }

    body.mkp-drawer-open .mkp-drawer{
      transform:translateX(0);
      visibility:visible;
    }

    .mkp-drawer-head{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:10px;
      padding:14px 12px 12px 16px;
      border-bottom:1px solid #e8f3e8;
      flex:0 0 auto;
    }

    .mkp-drawer-title{
      font-size:12px;
      font-weight:800;
      color:#536078;
      text-transform:uppercase;
      letter-spacing:.08em;
    }

    .mkp-drawer-close{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      width:40px;
      height:40px;
      min-width:40px;
      padding:0;
      border:1px solid #d9e4d9;
      border-radius:11px;
      background:#fff;
      color:#182118;
      cursor:pointer;
      transition:background .15s,border-color .15s;
    }

    .mkp-drawer-close:hover,
    .mkp-drawer-close:focus-visible{
      background:#f2f8f2;
      border-color:#2e7d32;
    }

    .mkp-drawer-close:focus-visible{
      outline:3px solid rgba(46,125,50,0.4);
      outline-offset:2px;
    }

    .mkp-drawer-nav{
      flex:1 1 auto;
      min-height:0;
      overflow-y:auto;
      overscroll-behavior:contain;
      -webkit-overflow-scrolling:touch;
      display:flex;
      flex-direction:column;
      gap:4px;
      padding:14px 12px 18px;
    }

    .mkp-drawer-group-label{
      margin:0 0 4px;
      padding:0 6px;
      font-size:11px;
      font-weight:800;
      color:#536078;
      text-transform:uppercase;
      letter-spacing:.08em;
    }

    .mkp-drawer-link{
      position:relative;
      display:flex;
      align-items:center;
      gap:12px;
      min-height:48px;
      padding:11px 12px;
      border-radius:14px;
      font-weight:700;
      font-size:14px;
      color:#536078;
      text-decoration:none;
      transition:background .2s ease,color .2s ease;
    }

    .mkp-drawer-link:hover,
    .mkp-drawer-link.is-active{
      background:#f4f7ff;
      color:#142044;
    }

    .mkp-drawer-link.is-active{
      font-weight:800;
    }

    .mkp-drawer-link:focus-visible{
      outline:3px solid rgba(47,95,224,0.45);
      outline-offset:2px;
    }

    .mkp-drawer-link::before{
      content:"";
      position:absolute;
      left:0;
      top:8px;
      bottom:8px;
      width:4px;
      border-radius:999px;
      background:transparent;
      transition:background .2s ease;
    }

    .mkp-drawer-link.is-active::before{
      background:linear-gradient(180deg,#2f5fe0,#16b7d4);
      box-shadow:0 6px 16px rgba(47,95,224,0.22);
    }

    .mkp-drawer-link-icon{
      width:34px;
      height:34px;
      min-width:34px;
      display:inline-flex;
      align-items:center;
      justify-content:center;
      border-radius:10px;
      background:#eef3ff;
      border:1px solid #cbd7f4;
      color:#2457d6;
      font-size:18px;
      flex:0 0 auto;
    }

    .mkp-drawer-link.is-active .mkp-drawer-link-icon{
      background:linear-gradient(135deg,#2f5fe0,#16b7d4);
      color:#fff;
      border-color:transparent;
      box-shadow:0 8px 18px rgba(47,95,224,0.2);
    }

    .mkp-drawer-link-label{
      min-width:0;
      overflow-wrap:anywhere;
    }

    .mkp-drawer-user{
      flex:0 0 auto;
      border-top:1px solid #e8f3e8;
      padding:14px 16px 18px;
      background:#f8fbf8;
      display:flex;
      flex-direction:column;
      gap:12px;
    }

    .mkp-drawer-user-top{
      display:flex;
      align-items:flex-start;
      gap:10px;
      min-width:0;
    }

    .mkp-drawer-avatar{
      width:38px;
      height:38px;
      min-width:38px;
      border-radius:50%;
      display:inline-flex;
      align-items:center;
      justify-content:center;
      background:linear-gradient(135deg,#2e7d32 0%,#4caf50 100%);
      color:#fff;
      font-size:17px;
      flex:0 0 auto;
    }

    .mkp-drawer-user-text{
      min-width:0;
      display:flex;
      flex-direction:column;
      gap:2px;
    }

    .mkp-drawer-user-name{
      margin:0;
      font-size:14px;
      font-weight:800;
      color:#1f4727;
      overflow-wrap:anywhere;
    }

    .mkp-drawer-user-email,
    .mkp-drawer-company{
      margin:0;
      font-size:12px;
      color:#5e6b5e;
      overflow-wrap:anywhere;
    }

    .mkp-drawer-auth-btn{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      width:100%;
      min-height:44px;
      padding:10px 14px;
      border-radius:12px;
      font-size:14px;
      font-weight:800;
      cursor:pointer;
      transition:background .15s,border-color .15s,color .15s;
    }

    .mkp-drawer-login{
      border:1px solid #2e7d32;
      background:linear-gradient(135deg,#2e7d32 0%,#3f9b44 100%);
      color:#fff;
    }

    .mkp-drawer-login:hover{
      filter:brightness(1.04);
    }

    .mkp-drawer-logout{
      border:1px solid #e2c9c9;
      background:#fff;
      color:#b42318;
    }

    .mkp-drawer-logout:hover{
      background:#fdeaea;
      border-color:#d9a2a2;
    }

    .mkp-drawer-auth-btn:focus-visible{
      outline:3px solid rgba(47,95,224,0.45);
      outline-offset:2px;
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

    /* Gammel permanent bundnavigation (og rester af den) må ikke længere vises. */
    .mobile-app-nav,
    .mobile-bottom-nav,
    .bottom-navigation,
    .app-mobile-nav,
    [data-mobile-nav]{
      display:none !important;
    }

    @media (max-width: 900px){
      .mkp-layout-topbar-inner{
        gap:10px;
      }

      .mkp-layout-brand-logo{
        height:38px;
        max-height:38px;
        max-width:210px;
      }
    }

    @media (max-width: 640px){
      .mkp-layout-topbar-inner{
        min-height:56px !important;
        padding:6px 0 !important;
        gap:8px;
      }

      .mkp-menu-btn{
        width:42px;
        height:42px;
        min-width:42px;
      }

      .mkp-layout-brand-logo{
        height:32px;
        max-height:32px;
        max-width:46vw;
      }

      .mkp-topbar-lang .language-btn{
        min-height:36px !important;
        padding:6px 9px !important;
        font-size:12px !important;
        line-height:1 !important;
      }

      .mkp-topbar-lang .language-flag{
        font-size:15px !important;
      }

      .mkp-drawer{
        width:min(320px, 88vw);
        max-width:88vw;
      }
    }
  `;

  document.head.appendChild(style);
}

// Holder styr på sidens scroll-lås, så vi kan genskabe præcis den tidligere værdi.
let drawerScrollLockState = null;

function lockPageScroll() {
  if (drawerScrollLockState) return;
  const body = document.body;
  drawerScrollLockState = {
    overflow: body.style.overflow,
    paddingRight: body.style.paddingRight
  };
  // Undgå layout-hop når scrollbaren forsvinder (desktop).
  const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
  body.style.overflow = "hidden";
  if (scrollbarWidth > 0) {
    body.style.paddingRight = `${scrollbarWidth}px`;
  }
}

function unlockPageScroll() {
  if (!drawerScrollLockState) return;
  const body = document.body;
  body.style.overflow = drawerScrollLockState.overflow || "";
  body.style.paddingRight = drawerScrollLockState.paddingRight || "";
  drawerScrollLockState = null;
}

const DRAWER_FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])'
].join(",");

function getDrawerFocusable(drawer) {
  return Array.from(drawer.querySelectorAll(DRAWER_FOCUSABLE))
    .filter((el) => !el.hasAttribute("hidden") && el.offsetParent !== null);
}

/**
 * Drawer-controller. Samme adfærd som regnskab.ewcp.dk (hamburger → slide-in fra
 * venstre + overlay) men med de accessibility-krav Madkontrollen stiller:
 * aria-expanded/aria-controls på hamburgeren, ESC lukker, fokus flyttes ind i
 * drawer'en og fanges der, og fokus vender tilbage til hamburgeren ved luk.
 */
function initDrawer() {
  const drawer = document.getElementById("mkpDrawer");
  const overlay = document.getElementById("mkpDrawerOverlay");
  const menuBtn = document.getElementById("mkpMenuBtn");
  const closeBtn = document.getElementById("mkpDrawerClose");
  if (!drawer || !overlay || !menuBtn) return;

  const isOpen = () => document.body.classList.contains("mkp-drawer-open");

  function openDrawer() {
    if (isOpen()) return;
    drawer.hidden = false;
    overlay.hidden = false;
    document.body.classList.add("mkp-drawer-open");
    document.documentElement.classList.add("mkp-drawer-open");
    drawer.setAttribute("aria-hidden", "false");
    menuBtn.setAttribute("aria-expanded", "true");
    lockPageScroll();
    // Fokus ind i drawer'en (luk-knappen først).
    window.requestAnimationFrame(() => {
      (closeBtn || getDrawerFocusable(drawer)[0] || drawer).focus?.();
    });
  }

  function closeDrawer({ restoreFocus = false } = {}) {
    if (!isOpen()) {
      // Sørg alligevel for at rester ikke bliver liggende.
      drawer.hidden = true;
      overlay.hidden = true;
      drawer.setAttribute("aria-hidden", "true");
      menuBtn.setAttribute("aria-expanded", "false");
      unlockPageScroll();
      return;
    }

    document.body.classList.remove("mkp-drawer-open");
    document.documentElement.classList.remove("mkp-drawer-open");
    drawer.setAttribute("aria-hidden", "true");
    menuBtn.setAttribute("aria-expanded", "false");
    unlockPageScroll();

    // Skjul efter transitionen, så slide-ud kan ses.
    window.setTimeout(() => {
      if (!isOpen()) {
        drawer.hidden = true;
        overlay.hidden = true;
      }
    }, 260);

    if (restoreFocus) menuBtn.focus?.();
  }

  menuBtn.addEventListener("click", () => {
    if (isOpen()) closeDrawer({ restoreFocus: true });
    else openDrawer();
  });

  closeBtn?.addEventListener("click", () => closeDrawer({ restoreFocus: true }));

  // Klik udenfor (overlay) lukker.
  overlay.addEventListener("click", () => closeDrawer({ restoreFocus: true }));

  // Navigation i drawer'en: luk altid, så mobilvisningen ikke efterlader
  // drawer'en åben oven på den nye side (siden navigerer uanset).
  drawer.addEventListener("click", (event) => {
    if (event.target.closest(".mkp-drawer-link, .mkp-drawer-auth-btn")) {
      closeDrawer();
    }
  });

  // ESC lukker + fokusfælde mens drawer'en er åben.
  document.addEventListener("keydown", (event) => {
    if (event.defaultPrevented) return;

    if (event.key === "Escape" && isOpen()) {
      event.preventDefault();
      closeDrawer({ restoreFocus: true });
      return;
    }

    if (event.key !== "Tab" || !isOpen()) return;

    const focusable = getDrawableFocusableSafe(drawer);
    if (!focusable.length) {
      event.preventDefault();
      drawer.focus?.();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && (active === first || !drawer.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || !drawer.contains(active))) {
      event.preventDefault();
      first.focus();
    }
  });

  // Luk hvis viewport skifter til en bred desktop-visning mens drawer'en er åben.
  window.addEventListener("resize", () => {
    if (isOpen() && window.innerWidth > 1280) closeDrawer();
  });

  bindDrawerAuthButton(drawer, closeDrawer);
}

function getDrawableFocusableSafe(drawer) {
  try {
    return getDrawerFocusable(drawer);
  } catch (error) {
    console.warn("[layout] drawer focus query failed:", error);
    return [];
  }
}

/**
 * Log ind / Log ud i drawerens bund.
 * Genbruger den EKSISTERENDE Firebase Auth-session:
 *   - "Log ind" åbner den eksisterende login-gate fra /core/auth.js (setupAuthGate).
 *   - "Log ud" kalder signOut(auth) og sender brugeren til forsiden — samme adfærd
 *     som /components/identity-block.js og /core/auth.js allerede bruger.
 */
function bindDrawerAuthButton(drawer, closeDrawer) {
  const logoutBtn = drawer.querySelector("#mkpDrawerLogout");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      logoutBtn.disabled = true;
      try {
        await signOut(auth);
        window.location.replace("/");
      } catch (error) {
        console.error("[layout] Log ud fejlede:", error);
        logoutBtn.disabled = false;
      }
    });
    return;
  }

  const loginBtn = drawer.querySelector("#mkpDrawerLogin");
  if (loginBtn) {
    loginBtn.addEventListener("click", () => {
      closeDrawer();
      // Login-gaten ejes af /core/auth.js. Er den allerede vist, fokuseres dens
      // e-mailfelt; ellers sendes brugeren til forsidens eksisterende login-flow.
      const gate = document.getElementById("mkpAuthGate");
      const emailInput = document.getElementById("mkpEmailInput");
      if (gate && emailInput && !gate.hidden) {
        emailInput.focus();
        return;
      }
      window.location.assign("/");
    });
  }
}

function mountDrawer(html) {
  let mount = document.getElementById("mkpDrawerMount");
  if (!mount) {
    mount = document.createElement("div");
    mount.id = "mkpDrawerMount";
    document.body.appendChild(mount);
  }
  mount.innerHTML = html;
  return mount;
}

function createDrawerAuthMarkup(signedIn) {
  return signedIn
    ? `<button type="button" class="mkp-drawer-auth-btn mkp-drawer-logout" id="mkpDrawerLogout" aria-label="Log ud">Log ud</button>`
    : `<button type="button" class="mkp-drawer-auth-btn mkp-drawer-login" id="mkpDrawerLogin" aria-label="Log ind">Log ind</button>`;
}

export async function loadLayout() {
  const currentPath = getCurrentPath();
  const entitlements = await getModuleEntitlements();
  const lang = localStorage.getItem("userLanguage") || "da";

  ensureLayoutStyles();

  mountMarkup("#headerMount", createHeaderMarkup(lang));
  mountDrawer(createDrawerMarkup(currentPath, entitlements, lang));
  initDrawer();

  // Drawerens bund viser først navn/e-mail når profilen er hentet. Vi henter den
  // asynkront, så layoutet ikke venter på Firestore. Uden login forbliver
  // "Ikke logget ind" + Log ind (login-gaten ejes fortsat af /core/auth.js).
  populateDrawerFromProfile().then((state) => {
    if (!state) return;
    const body = document.getElementById("mkpDrawerUserBody");
    if (!body) return;
    body.innerHTML = createDrawerUserBodyMarkup(state);
    const drawer = document.getElementById("mkpDrawer");
    if (drawer) bindDrawerAuthButton(drawer, () => {});
  }).catch((error) => {
    console.warn("[layout] drawer user render failed:", error);
  });

  // Init language switcher in topbar
  try {
    const { initI18n } = await import("/core/i18n.js");
    await initI18n();
  } catch (e) {
    console.warn("[layout] i18n init failed:", e);
  }

  // Init persistent cooling overlay (shows on any page if a run is active)
  try {
    const { initCoolingOverlay } = await import("/core/cooling-overlay.js?v=20260829-mobile-routine-v4");
    initCoolingOverlay();
  } catch (err) {
    console.warn("[layout] cooling-overlay init feil:", err);
  }
}
