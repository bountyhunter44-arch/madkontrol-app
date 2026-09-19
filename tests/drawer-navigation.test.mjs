// Madkontrollen – drawer-navigation (2026-09-19).
//
// Den permanente sidebar (desktop) og den faste bundnavigation (mobil) er erstattet
// af ÉN skjult venstre-drawer, åbnet med ☰ i topbaren — samme navigationstype som
// regnskab.ewcp.dk (madkontrollen-accounting/public/core/app-shell.js: hamburger +
// slide-in sidebar fra venstre + overlay, åbnet via body-klasse).
//
// Denne test dækker de 13 påkrævede cases:
//   1. menu hidden initially                     8. logout shown when signed in
//   2. hamburger opens                           9. old permanent sidebar absent
//   3. close button closes                      10. desktop full-width content
//   4. overlay closes                           11. mobile drawer within viewport
//   5. ESC closes                               12. no duplicate navigation
//   6. active page marked                       13. auth flow unchanged
//   7. login shown when signed out
//
//   node --test tests/drawer-navigation.test.mjs
//
// Testene er statiske kildekontroller (ingen browser, ingen netværk, ingen secrets).
// De læser den FAKTISKE runtime-kilde og fejler hvis et krav fjernes igen.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

function readPublic(rel) {
  return readFileSync(fileURLToPath(new URL(`../public/${rel}`, import.meta.url)), "utf8");
}

const LAYOUT = readPublic("core/layout.js");
const STYLE = readPublic("css/style.css");
const DASHBOARD_CSS = readPublic("css/dashboard.css");
const DASHBOARD_HTML = readPublic("dashboard.html");
const AUTH = readPublic("core/auth.js");

// Alle sider der deler skallen (én navigation for hele appen).
const SHELL_PAGES = [
  "core/billed-arkiv.html",
  "kontrol.html",
  "modules/egenkontrol/afvigelser.html",
  "modules/egenkontrol/logbooks.html",
  "modules/egenkontrol/rapporter.html",
  "modules/egenkontrol/risikoanalyse.html",
  "modules/egenkontrol/risikoanalyse-inspiration.html",
  "modules/egenkontrol/rutiner.html",
  "modules/egenkontrol/start-dag.html",
  "modules/egenkontrol/view-haccp.html",
  "dashboard.html"
];

function has(source, needle, message) {
  assert.ok(source.includes(needle), message || `mangler: ${needle}`);
}

function hasRe(source, pattern, message) {
  assert.ok(pattern.test(source), message || `mangler mønster: ${pattern}`);
}

// ------------------------------------------------------------------- 1, 5, 7

test("1. Menu er skjult som default — ingen reserveret sidebar-bredde", () => {
  // Drawer + overlay har hidden-attribut i markup.
  hasRe(LAYOUT, /id="mkpDrawer"\s+role="navigation"[\s\S]*?aria-hidden="true"\s+tabindex="-1"\s+hidden/, "drawer har hidden + aria-hidden som default");
  hasRe(LAYOUT, /id="mkpDrawerOverlay" hidden/, "overlay har hidden som default");

  // Lukket tilstand er skubbet ud af viewporten.
  hasRe(LAYOUT, /\.mkp-drawer\{[\s\S]*?transform:translateX\(-102%\)/, "lukket drawer ligger uden for venstre kant");
  hasRe(LAYOUT, /\.mkp-drawer\{[\s\S]*?visibility:hidden/, "lukket drawer er ikke fokusérbar");

  // Ingen bredde reserveres længere.
  hasRe(LAYOUT, /#sidebarMount\{\s*display:contents !important;/, "#sidebarMount reserverer ingen bredde");
  hasRe(STYLE, /#sidebarMount,\s*\n\.dashboard-sidebar\{\s*\n\s*display:contents !important;/, "style.css gør mountet pladsfrit");
  has(STYLE, "--sidebar-width:0px", "--sidebar-width er 0");
  assert.ok(!/\.app-layout\{\s*display:grid;\s*grid-template-columns:var\(--sidebar-width\)/.test(STYLE),
    ".app-layout reserverer ikke længere en sidebar-kolonne");
});

test("5. ESC lukker drawer'en", () => {
  hasRe(LAYOUT, /event\.key === "Escape" && isOpen\(\)/, "ESC håndteres kun når drawer'en er åben");
  hasRe(LAYOUT, /event\.preventDefault\(\);\s*\n\s*closeDrawer\(\{ restoreFocus: true \}\)/, "ESC lukker og gendanner fokus");
  hasRe(LAYOUT, /document\.addEventListener\("keydown"/, "keydown-lytter er registreret");
});

test("Drawer'en åbnes/lukkes via body.mkp-drawer-open (samme mønster som regnskab)", () => {
  hasRe(LAYOUT, /body\.mkp-drawer-open \.mkp-drawer\{[\s\S]*?transform:translateX\(0\)/, "CSS åbner drawer via body-klasse");
  hasRe(LAYOUT, /classList\.add\("mkp-drawer-open"\)/, "open tilføjer body-klassen");
  hasRe(LAYOUT, /classList\.remove\("mkp-drawer-open"\)/, "close fjerner body-klassen");
  hasRe(LAYOUT, /body\.mkp-drawer-open \.mkp-drawer-overlay\{\s*opacity:1/, "overlay vises når drawer er åben");
});

test("7. Log ind vises når man ikke er logget ind", () => {
  hasRe(LAYOUT, /signedIn\s*\n?\s*\? `<button type="button" class="mkp-drawer-auth-btn mkp-drawer-logout" id="mkpDrawerLogout" aria-label="Log ud">Log ud<\/button>`\s*\n?\s*: `<button type="button" class="mkp-drawer-auth-btn mkp-drawer-login" id="mkpDrawerLogin" aria-label="Log ind">Log ind<\/button>`/,
    "createDrawerAuthMarkup vælger Log ind når man ikke er logget ind");
  has(LAYOUT, '"Ikke logget ind"', "viser 'Ikke logget ind'");
  has(LAYOUT, "Log ind for at se dine data", "hjælpetekst for udlogget tilstand");
});

// -------------------------------------------------------------------- 2, 3, 4

test("2. Hamburger (☰) i topbaren åbner drawer'en", () => {
  hasRe(LAYOUT, /class="mkp-menu-btn"[\s\S]*?id="mkpMenuBtn"[\s\S]*?aria-label="Åbn menu"[\s\S]*?aria-expanded="false"[\s\S]*?aria-controls="mkpDrawer"/,
    "hamburger har aria-label, aria-expanded og aria-controls");
  has(LAYOUT, 'd="M3 6h18M3 12h18M3 18h18"', "hamburger-ikon (tre streger)");
  hasRe(LAYOUT, /menuBtn\.addEventListener\("click"[\s\S]*?openDrawer\(\)/, "klik åbner drawer'en");
  hasRe(LAYOUT, /menuBtn\.setAttribute\("aria-expanded", "true"\)/, "open sætter aria-expanded=true");
  hasRe(LAYOUT, /menuBtn\.setAttribute\("aria-expanded", "false"\)/, "close sætter aria-expanded=false");
});

test("3. Luk-knappen (×) lukker drawer'en", () => {
  hasRe(LAYOUT, /class="mkp-drawer-close"[\s\S]*?id="mkpDrawerClose"[\s\S]*?aria-label="Luk menu"/, "luk-knap med aria-label");
  hasRe(LAYOUT, /closeBtn\?\.addEventListener\("click", \(\) => closeDrawer\(\{ restoreFocus: true \}\)\)/, "luk-knap kalder closeDrawer");
});

test("4. Klik på overlay lukker drawer'en", () => {
  hasRe(LAYOUT, /overlay\.addEventListener\("click", \(\) => closeDrawer\(\{ restoreFocus: true \}\)\)/, "overlay-klik lukker");
  hasRe(LAYOUT, /<div class="mkp-drawer-overlay" id="mkpDrawerOverlay" hidden><\/div>/, "overlay er et separat element");
  hasRe(LAYOUT, /\.mkp-drawer-overlay\{\s*\n\s*position:fixed;\s*\n\s*inset:0;/, "overlay dækker hele viewporten");
});

test("Luk efter navigation: klik på et menupunkt lukker drawer'en", () => {
  hasRe(LAYOUT, /closest\("\.mkp-drawer-link, \.mkp-drawer-auth-btn"\)/, "nav-klik lukker drawer'en");
});

// ------------------------------------------------------------------------- 6

test("6. Aktuel side markeres tydeligt i menuen", () => {
  hasRe(LAYOUT, /const isActive = isPathMatch\(currentPath, item\.href\)/, "aktiv side beregnes pr. menupunkt");
  hasRe(LAYOUT, /class="mkp-drawer-link\$\{isActive \? " is-active" : ""\}"/, "aktivt punkt får is-active");
  hasRe(LAYOUT, /\$\{isActive \? 'aria-current="page"' : ""\}/, "aktivt punkt får aria-current=page");
  hasRe(LAYOUT, /\.mkp-drawer-link\.is-active\{[\s\S]*?font-weight:800/, "aktivt punkt er fremhævet");
  hasRe(LAYOUT, /\.mkp-drawer-link\.is-active::before\{[\s\S]*?background:linear-gradient/, "aktivt punkt har visuel indikator");
  hasRe(LAYOUT, /\.mkp-drawer-link\.is-active \.mkp-drawer-link-icon\{[\s\S]*?background:linear-gradient/, "aktivt ikon er fremhævet");
});

// ------------------------------------------------------------------------- 8

test("8. Log ud + bruger vises når man er logget ind", () => {
  has(LAYOUT, 'id="mkpDrawerLogout"', "Log ud-knap findes");
  has(LAYOUT, 'aria-label="Log ud"', "Log ud har aria-label");
  has(LAYOUT, 'id="mkpDrawerUserName"', "brugernavn vises");
  has(LAYOUT, 'id="mkpDrawerUserEmail"', "email vises");
  has(LAYOUT, "mkp-drawer-company", "virksomhed/rolle-linje findes");
  hasRe(LAYOUT, /const name = signedIn \? escapeHtml\(state\.userName\) : "Ikke logget ind"/, "falder tilbage til 'Ikke logget ind'");
  hasRe(LAYOUT, /const email = signedIn \? escapeHtml\(state\.email \|\| "Ikke angivet"\)/, "falder tilbage til 'Ikke angivet' for email");
});

test("8b. Login/logout ligger i drawerens bund — ikke i topbaren", () => {
  const header = LAYOUT.slice(LAYOUT.indexOf("export function createHeaderMarkup"));
  const headerBody = header.slice(0, header.indexOf("async function populateDrawerFromProfile"));
  assert.ok(!/mkpLogoutMount|mkpLogoutBtn|identityBlockMount/.test(headerBody), "topbaren har ingen login/logout-mounts");
  assert.ok(!/Log ind|Log ud/.test(headerBody), "topbaren har ingen Log ind/Log ud-knapper");

  // Brugerområdet ligger efter navigationen i drawer-markup'en.
  const drawerStart = LAYOUT.indexOf("export function createDrawerMarkup");
  const drawerBody = LAYOUT.slice(drawerStart, LAYOUT.indexOf("function ensureLayoutStyles"));
  const navIdx = drawerBody.indexOf('class="mkp-drawer-nav"');
  const userIdx = drawerBody.indexOf('id="mkpDrawerUserBody"');
  assert.ok(navIdx !== -1 && userIdx !== -1, "både navigation og brugerområde findes i drawer'en");
  assert.ok(userIdx > navIdx, "brugerområdet ligger under navigationen (bunden)");
});

// -------------------------------------------------------------------- 9 + 12

test("9. Den gamle permanente sidebar er væk", () => {
  assert.ok(!LAYOUT.includes("createSidebarMarkup"), "createSidebarMarkup er fjernet fra layout.js");
  assert.ok(!LAYOUT.includes("mkp-layout-sidebar"), "den gamle sidebar-klasse er fjernet fra layout.js");
  assert.ok(!STYLE.includes("mkp-layout-sidebar"), "den gamle sidebar-klasse er fjernet fra style.css");
  assert.ok(!/position:fixed !important;\s*\n\s*left:12px !important;\s*\n\s*right:12px !important/.test(STYLE),
    "den faste bundnavigation er fjernet fra style.css");
  assert.ok(!STYLE.includes("--mobile-bottom-nav-height:82px"), "bundnavigationens højde-reserve er væk");
  assert.ok(!/\.sidebar\{\s*\n\s*border-radius:24px;/.test(STYLE), "den gamle sticky sidebar-regel er væk");

  for (const page of SHELL_PAGES) {
    const html = readPublic(page);
    assert.ok(!html.includes('class="sidebar-link'), `${page} har ikke længere sidebar-links`);
    assert.ok(!html.includes('class="sidebar-badge'), `${page} har ikke længere sidebar-badges`);
    assert.ok(!html.includes('<aside class="dashboard-sidebar"'), `${page} har ikke længere en dashboard-sidebar`);
  }
  assert.ok(!DASHBOARD_HTML.includes('class="sidebar-link'), "dashboard.html har ikke hardkodede sidebar-links");
  assert.ok(!DASHBOARD_HTML.includes("dashboard-sidebar"), "dashboard.html har ikke en dashboard-sidebar");
  assert.ok(!DASHBOARD_HTML.includes('<header class="topbar">'), "dashboard.html har ikke sin egen topbar");
  assert.ok(!DASHBOARD_CSS.includes("dashboard-sidebar"), "dashboard.css har ikke sidebar-regler tilbage");
  assert.ok(!/grid-template-columns:\s*280px minmax\(0, 1fr\)/.test(DASHBOARD_CSS), "dashboard.css reserverer ikke en sidebar-kolonne");
});

test("12. Ingen dobbelt navigation (én kilde til menupunkter)", () => {
  has(DASHBOARD_HTML, "/core/layout.js", "dashboard.html bruger den fælles skalle");
  has(DASHBOARD_HTML, "await loadLayout()", "dashboard.html kalder loadLayout");
  has(DASHBOARD_HTML, 'id="headerMount"', "dashboard.html har det fælles header-mount");

  for (const page of SHELL_PAGES) {
    const html = readPublic(page);
    assert.ok(!html.includes('class="sidebar-link'), `${page} bygger ikke sine egne navigationspunkter`);
    assert.ok(!/<nav class="nav">/.test(html), `${page} har ikke en ekstra topbar-nav`);
  }

  // Menupunkterne defineres ét sted: getNavItems() i layout.js.
  const navItemCount = (LAYOUT.match(/\n\s+key: "[a-z-]+",\n\s+labelKey?:/g) || []).length;
  assert.ok(navItemCount >= 7, `getNavItems() definerer menupunkterne ét sted (fandt ${navItemCount})`);
  assert.equal((STYLE.match(/sidebar-link/g) || []).length, 0, "style.css indeholder ingen sidebar-links");
});

// ------------------------------------------------------------------------ 10

test("10. Desktop: main content bruger hele bredden når menuen er lukket", () => {
  hasRe(STYLE, /\.app-layout\{\s*\n\s*display:block;\s*\n\s*width:100%;\s*\n\s*max-width:100%;/, ".app-layout er fuld bredde");
  hasRe(readPublic("kontrol.html"), /\.control-layout\{\s*\n\s*display:block;/, "kontrol.html reserverer ingen sidebar-kolonne");
  hasRe(readPublic("modules/egenkontrol/start-dag.html"), /\.startday-layout\{\s*\n\s*display:block;/, "start-dag.html reserverer ingen sidebar-kolonne");
  hasRe(LAYOUT, /\.mkp-drawer\{\s*\n\s*position:fixed;/, "drawer er fixed og skubber ikke indholdet");
  hasRe(LAYOUT, /\.mkp-layout-topbar-inner\{\s*\n\s*min-height:64px;/, "topbaren er kompakt");
  // Drawer-bredde på desktop ligger i det krævede interval 280–320 px.
  const width = LAYOUT.match(/\.mkp-drawer\{[\s\S]*?width:(\d+)px/);
  assert.ok(width, "drawer har en fast bredde");
  const px = Number(width[1]);
  assert.ok(px >= 280 && px <= 320, `desktop-drawer er ${px}px (krav: 280–320px)`);
});

// ------------------------------------------------------------------------ 11

test("11. Mobil: drawer max 88vw, overlay bagved, scroll-lås og intern scroll", () => {
  hasRe(LAYOUT, /\.mkp-drawer\{[\s\S]*?max-width:88vw/, "drawer er max 88vw");
  hasRe(LAYOUT, /@media \(max-width: 640px\)\{[\s\S]*?width:min\(320px, 88vw\)/, "mobil-drawer er begrænset til 88vw");

  const drawerZ = LAYOUT.match(/\.mkp-drawer\{[\s\S]*?z-index:(\d+)/);
  const overlayZ = LAYOUT.match(/\.mkp-drawer-overlay\{[\s\S]*?z-index:(\d+)/);
  assert.ok(drawerZ && overlayZ, "både drawer og overlay har z-index");
  assert.ok(Number(drawerZ[1]) > Number(overlayZ[1]), "overlay ligger bag drawer'en");

  has(LAYOUT, "overscroll-behavior:contain", "bagvedliggende scroll-kæde blokeres");
  hasRe(LAYOUT, /\.mkp-drawer-nav\{[\s\S]*?overflow-y:auto/, "menuen kan scrolles internt");
  has(LAYOUT, "env(safe-area-inset-bottom", "safe-area bund respekteres");
  has(LAYOUT, "env(safe-area-inset-top", "safe-area top respekteres");
  hasRe(LAYOUT, /\.mkp-drawer\{[\s\S]*?padding-right:env\(safe-area-inset-right/, "safe-area højre respekteres (ingen horisontal scrolling)");

  hasRe(LAYOUT, /html\.mkp-drawer-open,\s*\n\s*body\.mkp-drawer-open\{\s*\n\s*overflow:hidden !important;/, "body-scroll låses mens drawer er åben");
  has(LAYOUT, "function lockPageScroll()", "scroll-lås er implementeret");
  has(LAYOUT, "function unlockPageScroll()", "scroll-lås kan ophæves");
  hasRe(LAYOUT, /lockPageScroll\(\);/, "open låser scrollen");
  hasRe(LAYOUT, /unlockPageScroll\(\);/, "close (og fejl-vejen) låser op");

  hasRe(STYLE, /html, body\{\s*\n\s*overflow-x:hidden;/, "ingen horisontal scrolling");
});

// ------------------------------------------------------------------------ 13

test("13. Auth-flowet er uændret (samme Firebase Auth, ingen ny login-model)", () => {
  hasRe(LAYOUT, /import \{ auth, db \} from "\.\/firebase-config\.js"/, "bruger samme firebase-config");
  hasRe(LAYOUT, /await signOut\(auth\)/, "Log ud bruger signOut(auth)");
  hasRe(LAYOUT, /window\.location\.replace\("\/"\)/, "Log ud sender brugeren til forsiden (uændret adfærd)");
  assert.ok(!/signInWithEmailAndPassword|signInWithPopup|createUserWithEmailAndPassword/.test(LAYOUT),
    "layout.js opretter ikke sit eget login");
  hasRe(LAYOUT, /window\.location\.assign\("\/"\)/, "Log ind falder tilbage til det eksisterende login-flow");
  hasRe(LAYOUT, /document\.getElementById\("mkpAuthGate"\)/, "Log ind genbruger den eksisterende login-gate");

  has(AUTH, "export async function setupAuthGate", "setupAuthGate er urørt");
  has(AUTH, 'window.location.assign("/dashboard")', "login-redirect til /dashboard er uændret");
  has(AUTH, 'window.location.assign("/admin/owner-dashboard.html")', "platform-admin-redirect er uændret");
  hasRe(AUTH, /onAuthStateChanged\(auth, async \(user\)/, "session genoprettes ved refresh via onAuthStateChanged");
  hasRe(AUTH, /await signInWithEmailAndPassword\(auth, email, password\)/, "email/password-login er uændret");
  hasRe(AUTH, /gate\.hidden = false;[\s\S]*?logoutBtn\.hidden = true;/, "udlogget tilstand: gate vises, logout skjules");
  hasRe(AUTH, /gate\.hidden = true;[\s\S]*?logoutBtn\.hidden = false;/, "indlogget tilstand: gate skjules, logout vises");

  // Den flydende topbar-Log ud optager ikke længere permanent plads.
  assert.ok(!/\.mkp-logout-btn \{\s*\n\s*position: fixed;/.test(AUTH), "Log ud ligger ikke fast i topbaren");
  hasRe(AUTH, /\.mkp-logout-mount \.mkp-logout-btn \{[\s\S]*?position: static !important;/, "Log ud kan stadig vises hvis en side ejer et synligt mount");
});

// ------------------------------------------------ menuindhold, roller, skallen

test("Menupunkterne er de eksisterende (urls + rækkefølge bevaret)", () => {
  const expected = [
    ['key: "dashboard"', 'href: "/dashboard"'],
    ['key: "rutiner"', 'href: "/modules/egenkontrol/rutiner.html"'],
    ['key: "afvigelser"', 'href: "/modules/egenkontrol/afvigelser.html"'],
    ['key: "risikoanalyse"', 'href: "/modules/egenkontrol/risikoanalyse.html"'],
    ['key: "risikoanalyse-inspiration"', 'href: "/modules/egenkontrol/risikoanalyse-inspiration.html"'],
    ['key: "rapporter"', 'href: "/modules/egenkontrol/rapporter.html?mode=authority"'],
    ['key: "billedarkiv"', 'href: "/core/billed-arkiv.html"'],
    ['key: "kontrol"', 'href: "/kontrol.html"']
  ];
  for (const [key, href] of expected) {
    has(LAYOUT, key, `menupunkt ${key} findes`);
    has(LAYOUT, href, `menupunkt peger på ${href}`);
  }

  // Rækkefølgen i getNavItems() er uændret.
  const order = expected.map(([key]) => LAYOUT.indexOf(key));
  for (let i = 1; i < order.length; i += 1) {
    assert.ok(order[i] > order[i - 1], `menurækkefølgen er bevaret ved ${expected[i][0]}`);
  }
});

test("Permissions/feature flags bevares (isNavItemEnabled bruges stadig)", () => {
  has(LAYOUT, "function isNavItemEnabled(item, entitlements)", "entitlement-check findes");
  hasRe(LAYOUT, /getNavItems\(\)\.filter\(\(item\) => isNavItemEnabled\(item, entitlements\)\)/, "drawer filtrerer på entitlements");
  has(LAYOUT, "return entitlements.coreEnabled !== false;", "core-modul respekterer coreEnabled");
  has(LAYOUT, "return entitlements.addons.has(", "tilkøb respekterer addons");
});

test("Alle skalle-sider har begge mounts og kalder loadLayout", () => {
  for (const page of SHELL_PAGES) {
    const html = readPublic(page);
    assert.ok(html.includes('id="headerMount"'), `${page} har headerMount`);
    assert.ok(html.includes('id="sidebarMount"'), `${page} har sidebarMount`);
    assert.ok(/from ["'][^"']*\/core\/layout\.js/.test(html), `${page} importerer layout.js`);
    assert.ok(/await loadLayout\(|loadLayout\(\)/.test(html), `${page} kalder loadLayout`);
  }
});

test("Topbaren har ☰ til venstre, logo, og kun kompakte ikoner til højre", () => {
  const start = LAYOUT.indexOf("export function createHeaderMarkup");
  const header = LAYOUT.slice(start, LAYOUT.indexOf("async function populateDrawerFromProfile"));

  // Rækkefølgen i den RETURNEREDE markup (logoMarkup-variablen er defineret før return).
  const returned = header.slice(header.indexOf("return `"));
  const menuIdx = returned.indexOf('id="mkpMenuBtn"');
  const brandIdx = returned.indexOf("${logoMarkup}");
  assert.ok(menuIdx !== -1 && brandIdx !== -1, "både hamburger og logo er med i topbaren");
  assert.ok(menuIdx < brandIdx, "hamburgeren står før logoet (venstre)");

  // Hamburgeren ligger i topbar-venstre, det kompakte område i topbar-højre.
  const rightIdx = returned.indexOf("mkp-layout-topbar-right");
  assert.ok(rightIdx > brandIdx, "det kompakte område står efter logoet (højre)");

  has(header, "languageSwitcherContainer", "sprogskifteren er bevaret i topbaren");
  assert.ok(!/topbar-info|topbar-info-item/.test(header), "den 116px høje info-blok er væk");
  assert.ok(!/mkpLogoutMount|mkpLogoutBtn/.test(header), "login/logout optager ingen topbar-plads");
});

test("Accessibility: roller, labels og fokusfælde", () => {
  has(LAYOUT, 'role="navigation"', "drawer har role=navigation (samme mønster som før)");
  has(LAYOUT, 'aria-label="Hovedmenu"', "drawer har aria-label");
  has(LAYOUT, 'aria-label="Åbn menu"', 'hamburger: aria-label="Åbn menu"');
  has(LAYOUT, 'aria-controls="mkpDrawer"', "hamburger: aria-controls");
  has(LAYOUT, 'aria-label="Luk menu"', 'luk-knap: aria-label="Luk menu"');
  has(LAYOUT, 'aria-label="Navigation"', "nav-landmark har aria-label");

  has(LAYOUT, "function getDrawerFocusable(drawer)", "fokusfælde er implementeret");
  hasRe(LAYOUT, /event\.key !== "Tab"/, "Tab håndteres i drawer'en");
  hasRe(LAYOUT, /menuBtn\.focus\?\.\(\)/, "fokus vender tilbage til hamburgeren ved luk");
  hasRe(LAYOUT, /\(closeBtn \|\| getDrawerFocusable\(drawer\)\[0\] \|\| drawer\)\.focus/, "fokus flyttes ind i drawer'en ved åbning");
  hasRe(LAYOUT, /drawer\.setAttribute\("aria-hidden", "false"\)/, "aria-hidden opdateres ved åbning");
});

test("Print: drawer og gammel bundnavigation skjules", () => {
  const printBlock = STYLE.slice(STYLE.indexOf("@media print"));
  has(printBlock, ".mkp-drawer,", "drawer skjules i print");
  has(printBlock, ".mkp-drawer-overlay", "overlay skjules i print");
  has(printBlock, ".mobile-bottom-nav", "gammel bundnavigation skjules i print");
});
