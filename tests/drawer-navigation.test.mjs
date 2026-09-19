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

// CRLF-KONTRAKT: git checkouter med core.autocrlf=true, så en frisk klon har CRLF.
// Alle læsninger normaliseres til LF her, så assertionerne giver samme resultat
// uanset checkout. Regexerne nedenfor er DERUDOVER skrevet \r?\n-robuste, så de
// også holder hvis en fil læses uden om denne helper.
const toLF = (text) => String(text).replace(/\r\n/g, "\n");

function readPublic(rel) {
  return toLF(readFileSync(fileURLToPath(new URL(`../public/${rel}`, import.meta.url)), "utf8"));
}

const LAYOUT = readPublic("core/layout.js");
const STYLE = readPublic("css/style.css");
const DASHBOARD_CSS = readPublic("css/dashboard.css");
const DASHBOARD_HTML = readPublic("dashboard.html");
const AUTH = readPublic("core/auth.js");

// Sider hvor loadLayout() kaldes UBETINGET i modulets topniveau, så skallen altid
// rendres. (logbooks.html kalder bevidst loadLayout() inde i setupAuthGate's
// onAuthenticated-callback og er derfor ikke med her — præ-eksisterende mønster.)
const TOPLEVEL_SHELL_PAGES = [
  "dashboard.html",
  "kontrol.html",
  "core/billed-arkiv.html",
  "modules/egenkontrol/rutiner.html",
  "modules/egenkontrol/start-dag.html",
  "modules/egenkontrol/afvigelser.html",
  "modules/egenkontrol/rapporter.html",
  "modules/egenkontrol/risikoanalyse.html",
  "modules/egenkontrol/risikoanalyse-inspiration.html",
  "modules/egenkontrol/view-haccp.html"
];

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
  assert.ok(toLF(source).includes(needle), message || `mangler: ${needle}`);
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
  hasRe(STYLE, /#sidebarMount,\s*\r?\n\.dashboard-sidebar\{\s*\r?\n\s*display:contents !important;/, "style.css gør mountet pladsfrit");
  has(STYLE, "--sidebar-width:0px", "--sidebar-width er 0");
  assert.ok(!/\.app-layout\{\s*display:grid;\s*grid-template-columns:var\(--sidebar-width\)/.test(STYLE),
    ".app-layout reserverer ikke længere en sidebar-kolonne");
});

test("5. ESC lukker drawer'en", () => {
  hasRe(LAYOUT, /event\.key === "Escape" && isOpen\(\)/, "ESC håndteres kun når drawer'en er åben");
  hasRe(LAYOUT, /event\.preventDefault\(\);\s*\r?\n\s*closeDrawer\(\{ restoreFocus: true \}\)/, "ESC lukker og gendanner fokus");
  hasRe(LAYOUT, /document\.addEventListener\("keydown"/, "keydown-lytter er registreret");
});

test("Drawer'en åbnes/lukkes via body.mkp-drawer-open (samme mønster som regnskab)", () => {
  hasRe(LAYOUT, /body\.mkp-drawer-open \.mkp-drawer\{[\s\S]*?transform:translateX\(0\)/, "CSS åbner drawer via body-klasse");
  hasRe(LAYOUT, /classList\.add\("mkp-drawer-open"\)/, "open tilføjer body-klassen");
  hasRe(LAYOUT, /classList\.remove\("mkp-drawer-open"\)/, "close fjerner body-klassen");
  hasRe(LAYOUT, /body\.mkp-drawer-open \.mkp-drawer-overlay\{\s*opacity:1/, "overlay vises når drawer er åben");
});

test("7. Log ind vises når man ikke er logget ind", () => {
  hasRe(LAYOUT, /signedIn\s*\r?\n?\s*\? `<button type="button" class="mkp-drawer-auth-btn mkp-drawer-logout" id="mkpDrawerLogout" aria-label="Log ud">Log ud<\/button>`\s*\r?\n?\s*: `<button type="button" class="mkp-drawer-auth-btn mkp-drawer-login" id="mkpDrawerLogin" aria-label="Log ind">Log ind<\/button>`/,
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
  hasRe(LAYOUT, /\.mkp-drawer-overlay\{\s*\r?\n\s*position:fixed;\s*\r?\n\s*inset:0;/, "overlay dækker hele viewporten");
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
  assert.ok(!/position:fixed !important;\s*\r?\n\s*left:12px !important;\s*\r?\n\s*right:12px !important/.test(STYLE),
    "den faste bundnavigation er fjernet fra style.css");
  assert.ok(!STYLE.includes("--mobile-bottom-nav-height:82px"), "bundnavigationens højde-reserve er væk");
  assert.ok(!/\.sidebar\{\s*\r?\n\s*border-radius:24px;/.test(STYLE), "den gamle sticky sidebar-regel er væk");

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
  // Mønsteret er \r?\n-robust, så det også matcher en CRLF-checkout (core.autocrlf=true).
  const navItemCount = (LAYOUT.match(/\r?\n\s+key: "[a-z-]+",\r?\n\s+labelKey?:/g) || []).length;
  assert.ok(navItemCount >= 7, `getNavItems() definerer menupunkterne ét sted (fandt ${navItemCount})`);
  assert.equal((STYLE.match(/sidebar-link/g) || []).length, 0, "style.css indeholder ingen sidebar-links");
});

// ------------------------------------------------------------------------ 10

test("10. Desktop: main content bruger hele bredden når menuen er lukket", () => {
  hasRe(STYLE, /\.app-layout\{\s*\r?\n\s*display:block;\s*\r?\n\s*width:100%;\s*\r?\n\s*max-width:100%;/, ".app-layout er fuld bredde");
  hasRe(readPublic("kontrol.html"), /\.control-layout\{\s*\r?\n\s*display:block;/, "kontrol.html reserverer ingen sidebar-kolonne");
  hasRe(readPublic("modules/egenkontrol/start-dag.html"), /\.startday-layout\{\s*\r?\n\s*display:block;/, "start-dag.html reserverer ingen sidebar-kolonne");
  hasRe(LAYOUT, /\.mkp-drawer\{\s*\r?\n\s*position:fixed;/, "drawer er fixed og skubber ikke indholdet");
  hasRe(LAYOUT, /\.mkp-layout-topbar-inner\{\s*\r?\n\s*min-height:64px;/, "topbaren er kompakt");
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

  hasRe(LAYOUT, /html\.mkp-drawer-open,\s*\r?\n\s*body\.mkp-drawer-open\{\s*\r?\n\s*overflow:hidden !important;/, "body-scroll låses mens drawer er åben");
  has(LAYOUT, "function lockPageScroll()", "scroll-lås er implementeret");
  has(LAYOUT, "function unlockPageScroll()", "scroll-lås kan ophæves");
  hasRe(LAYOUT, /lockPageScroll\(\);/, "open låser scrollen");
  hasRe(LAYOUT, /unlockPageScroll\(\);/, "close (og fejl-vejen) låser op");

  hasRe(STYLE, /html, body\{\s*\r?\n\s*overflow-x:hidden;/, "ingen horisontal scrolling");
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
  assert.ok(!/\.mkp-logout-btn \{\s*\r?\n\s*position: fixed;/.test(AUTH), "Log ud ligger ikke fast i topbaren");
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

// ---------------------------------------------------- topbar/hamburger-regression

test("shared topbar and hamburger are visible on dashboard", () => {
  // Regression: 33f7711 fjernede sidebar-markup OG funktionen mountMarkup(), men
  // loadLayout() kaldte den stadig. Det gav "ReferenceError: mountMarkup is not
  // defined", #headerMount forblev tom, og dashboardet endte uden topbar og uden
  // ☰ — så drawer'en ikke kunne åbnes. Denne test fanger begge dele.
  const header = createHeaderMarkupSource();

  // 1. Topbar-markup indeholder både topbar, hamburger og drawer-kontrakten.
  has(header, 'class="topbar mkp-layout-topbar"', "topbar-elementet findes i createHeaderMarkup");
  has(header, 'id="mkpMenuBtn"', "hamburgeren findes i createHeaderMarkup");
  has(header, 'aria-label="Åbn menu"', 'hamburgeren har aria-label="Åbn menu"');
  has(header, 'aria-controls="mkpDrawer"', "hamburgeren peger på drawer'en");
  has(header, 'aria-expanded="false"', "hamburgeren starter sammenklappet");
  has(header, "mkp-menu-btn", "hamburgeren har en synlig knap-klasse");
  assert.ok(!/mkp-layout-topbar[^>]*hidden/.test(header), "topbaren er ikke hidden i markup");

  // 2. loadLayout() monterer topbaren i #headerMount (ellers er der ingen trigger).
  hasRe(LAYOUT, /mountMarkup\("#headerMount", createHeaderMarkup\(lang\)\)/, "loadLayout monterer topbaren i #headerMount");
  hasRe(LAYOUT, /mountDrawer\(createDrawerMarkup\(currentPath, entitlements, lang\)\)/, "loadLayout monterer drawer'en");
  hasRe(LAYOUT, /initDrawer\(\)/, "loadLayout kalder initDrawer()");

  // 3. #headerMount skal findes i DOM'en på dashboardet, før scriptet kører.
  has(DASHBOARD_HTML, 'id="headerMount"', "dashboard.html har #headerMount");
  has(DASHBOARD_HTML, 'id="sidebarMount"', "dashboard.html har #sidebarMount");
  const headerIdx = DASHBOARD_HTML.indexOf('id="headerMount"');
  const mainIdx = DASHBOARD_HTML.indexOf('<main class="page-shell');
  assert.ok(headerIdx !== -1 && mainIdx !== -1 && headerIdx < mainIdx, "#headerMount står før main-indholdet");

  // 4. loadLayout() kaldes i modulets topniveau, så skallen rendres uanset auth-state.
  for (const page of TOPLEVEL_SHELL_PAGES) {
    const html = readPublic(page);
    assert.ok(/^\s*await loadLayout\(\);/m.test(html), `${page}: loadLayout() kaldes i topniveau`);
  }
  // Dashboardets kald står ikke inde i onAuthenticated.
  const dashCall = DASHBOARD_HTML.indexOf("await loadLayout()");
  const dashAuth = DASHBOARD_HTML.indexOf("setupAuthGate({");
  assert.ok(dashCall !== -1 && dashAuth !== -1 && dashCall < dashAuth,
    "dashboard.html kalder loadLayout() FØR setupAuthGate()");

  // 5. Topbar-CSS'en må ikke skjule den.
  const topbarRules = LAYOUT.slice(LAYOUT.indexOf(".mkp-layout-topbar{"), LAYOUT.indexOf(".mkp-layout-topbar-right{"));
  assert.ok(!/display\s*:\s*none/.test(topbarRules), "topbar-reglerne indeholder ikke display:none");
  assert.ok(!/visibility\s*:\s*hidden/.test(topbarRules), "topbar-reglerne indeholder ikke visibility:hidden");
  assert.ok(!/height\s*:\s*0/.test(topbarRules), "topbar-reglerne har ikke height:0");
  has(LAYOUT, "position:sticky", "topbaren er sticky på desktop (☰ scroller ikke væk)");
  has(DASHBOARD_CSS, ".topbar-inner", "dashboard.css har stadig topbar-inner-regler");

  // 6. Ingen kald til en funktion der ikke er defineret i layout.js.
  //    (Fanger præcis "mountMarkup is not defined"-klassen.)
  for (const name of ["mountMarkup", "mountDrawer", "createHeaderMarkup", "createDrawerMarkup", "initDrawer"]) {
    assert.ok(new RegExp(`function\\s+${name}\\s*\\(`).test(LAYOUT), `${name}() er defineret i layout.js`);
  }
  hasRe(LAYOUT, /mountMarkup\("#headerMount"/, "mountMarkup bruges også (definitionen må ikke fjernes)");
});

// Hjælper: kilden til createHeaderMarkup() (fra funktionsstart til næste top-level funktion).
function createHeaderMarkupSource() {
  const start = LAYOUT.indexOf("function createHeaderMarkup(");
  const end = LAYOUT.indexOf("async function populateDrawerFromProfile(");
  assert.ok(start !== -1 && end > start, "createHeaderMarkup() findes i layout.js");
  return LAYOUT.slice(start, end);
}

// ------------------------------------------- mobil topbar: ☰ + logo + sprog

test("mobile topbar shows hamburger + logo + language control", () => {
  // Regression: style.css's mobile-blok skjulte .brand/.brand-logo med
  // display:none !important, så mobil-topbaren kun havde ☰ + sprog.
  const mobileCss = STYLE.slice(STYLE.indexOf("@media (max-width: 760px)"), STYLE.indexOf("@media (max-width: 640px)"));
  assert.ok(mobileCss.length > 0, "mobil-blokken i style.css findes");

  // Logoet må IKKE være i en display:none-liste i mobil-blokken.
  const hideBlocks = mobileCss.match(/[^{}]*\{\s*display\s*:\s*none\s*!important;?\s*\}/g) || [];
  for (const block of hideBlocks) {
    assert.ok(!/(^|[\s,])\.brand\s*[,{]/.test(block), "mobil-CSS skjuler ikke .brand med display:none");
    assert.ok(!/(^|[\s,])\.brand-logo\s*[,{]/.test(block), "mobil-CSS skjuler ikke .brand-logo med display:none");
    assert.ok(!/mkp-layout-brand/.test(block), "mobil-CSS skjuler ikke .mkp-layout-brand");
  }

  // Logoet skal aktivt vises og være størrelsesbegrænset, så det ikke skubber ☰ ud.
  hasRe(STYLE, /\.brand,\s*\r?\n\s*\.brand-logo\{\s*\r?\n\s*display:block !important;/, "mobil-CSS viser logoet eksplicit");
  hasRe(STYLE, /\.mkp-layout-brand\{[\s\S]{0,160}?display:flex !important;/, "brand-links beholdes som flex");
  hasRe(STYLE, /\.mkp-layout-brand-logo\{[\s\S]{0,200}?max-width:42vw !important;/, "logoet er breddebegrænset på mobil");
  hasRe(STYLE, /\.mkp-layout-brand-logo\{[\s\S]{0,200}?object-fit:contain;/, "logoet bevarer aspect ratio");
  assert.ok(!/\.brand-logo\{[^}]*display\s*:\s*none/.test(STYLE), "ingen display:none på .brand-logo i style.css");

  // Topbaren har alle tre elementer i den rigtige rækkefølge.
  const header = createHeaderMarkupSource();
  const menuIdx = header.indexOf('id="mkpMenuBtn"');
  const logoIdx = header.indexOf("${logoMarkup}");
  const rightIdx = header.indexOf("mkp-layout-topbar-right");
  assert.ok(menuIdx !== -1 && logoIdx !== -1 && rightIdx !== -1, "☰, logo og højre-område findes");
  assert.ok(menuIdx < logoIdx, "☰ står til venstre for logoet");
  assert.ok(logoIdx < rightIdx, "logoet står til venstre for sprog/kompakte controls");

  // Hamburgeren må ikke kunne klemmes væk af logoet.
  hasRe(LAYOUT, /\.mkp-menu-btn\{[\s\S]{0,400}?flex:0 0 auto;/, "☰ har flex:0 0 auto (kan ikke klemmes)");
  hasRe(LAYOUT, /\.mkp-layout-brand-logo\{[\s\S]{0,200}?height:44px;/, "logoet har fast højde");
  // Ingen ubetinget skjulning af brand i layout.js.
  assert.ok(!/\.mkp-layout-brand[^{]*\{[^}]*display\s*:\s*none/.test(LAYOUT), "layout.js skjuler ikke brand");
});

// ------------------------------------ auth-shell overlever login (mobil)

test("auth shell survives mobile login (topbar + ☰ efter gate lukkes)", () => {
  // Gaten (core/auth.js) og skallen (core/layout.js) er to uafhængige moduler.
  // Denne test fastholder kontrakten: gaten må ikke skjule skallen, og skallen
  // skal kunne monteres uafhængigt af auth-state.
  has(AUTH, "gate.hidden = true", "gaten skjules når brugeren er logget ind");
  has(AUTH, "gate.hidden = false", "gaten vises når brugeren er logget ud");
  assert.ok(!/mkp-layout-topbar|mkpMenuBtn|mkpDrawer/.test(AUTH),
    "auth.js rører ikke topbar/drawer-markup (skallen ejes af layout.js)");

  // loadLayout() kalder ikke setupAuthGate og venter ikke på auth.
  const loadLayoutBody = LAYOUT.slice(LAYOUT.indexOf("export async function loadLayout()"));
  assert.ok(!/setupAuthGate|onAuthStateChanged/.test(loadLayoutBody),
    "loadLayout() venter ikke på auth — skallen monteres uanset login-state");

  // ☰-triggeren og drawer'en er i DOM'en, også før login (gaten er et overlay).
  has(LAYOUT, 'id="mkpMenuBtn"', "☰ findes i markup uafhængigt af auth");
  has(LAYOUT, 'id="mkpDrawer"', "drawer findes i markup uafhængigt af auth");
  has(LAYOUT, 'id="mkpDrawerLogin"', "Log ind-knap i drawerens bund");
  has(LAYOUT, 'id="mkpDrawerLogout"', "Log ud-knap i drawerens bund");
  hasRe(LAYOUT, /signOut\(auth\)/, "Log ud bruger signOut(auth)");
});

test("Log ud bruger en signOut der faktisk er importeret fra firebase-auth", () => {
  // Regression: drawerens Log ud kaldte signOut(auth), men funktionen blev aldrig
  // importeret → "ReferenceError: signOut is not defined" ved klik. Log ud virkede
  // derfor ikke i produktion, mens testsuiten var grøn.
  const authImport = LAYOUT.split(/\r?\n/).find((l) => /from "https:\/\/www\.gstatic\.com[^"]*firebase-auth\.js"/.test(l));
  assert.ok(authImport, "layout.js importerer fra firebase-auth.js");
  assert.ok(/\bsignOut\b/.test(authImport), "signOut er en del af import-listen: " + authImport.trim());
  assert.ok(/\bonAuthStateChanged\b/.test(authImport), "onAuthStateChanged er stadig importeret");
  hasRe(LAYOUT, /await signOut\(auth\)/, "signOut kaldes som importeret funktion");
});

// ------------------------------- company/location-context: skallen må ikke røre den

test("company/location-context røres ikke af skallen (samme nøgler som koden bruger)", () => {
  // De FAKTISKE nøgler fra den eksisterende model:
  //   sessionStorage: mkp_user_uid, mkp_user_companyId, mkp_selected_locationId,
  //                   mkp_user_locationIds, mkp_user_role   (skrives af core/auth.js)
  //   localStorage:   selectedLocationId                    (skrives af core/session.js)
  const CONTEXT_KEYS = [
    "mkp_user_uid", "mkp_user_companyId", "mkp_selected_locationId",
    "mkp_user_locationIds", "mkp_user_role", "selectedLocationId"
  ];

  // layout.js må ikke skrive eller slette context-nøgler.
  for (const key of CONTEXT_KEYS) {
    assert.ok(!new RegExp(`(setItem|removeItem)\\(\\s*["']${key}["']`).test(LAYOUT),
      `layout.js skriver/sletter ikke ${key}`);
  }
  // Den må kun LÆSE dem (drawerens brugerområde + impersonation-visning).
  assert.ok(/mkp_/.test(LAYOUT) || /getEffectiveCompanyId/.test(LAYOUT), "layout.js læser context via de eksisterende helpers");

  // Sletningen sker fortsat kun i auth.js (ved sign-out) og i onboardingService.
  hasRe(AUTH, /removeItem\("mkp_user_companyId"\)/, "auth.js rydder company ved sign-out (uændret)");
  hasRe(AUTH, /removeItem\("mkp_selected_locationId"\)/, "auth.js rydder location ved sign-out (uændret)");
  hasRe(AUTH, /setItem\("mkp_user_companyId"/, "auth.js skriver company ved login (uændret)");
  hasRe(AUTH, /setItem\("mkp_selected_locationId"/, "auth.js skriver location ved login (uændret)");
  hasRe(AUTH, /onAuthStateChanged\(auth, async \(user\)/, "session genoprettes ved refresh (uændret)");

  // Context-provideren og session.js er urørte af drawer-arbejdet.
  const ctxProvider = readPublic("platform/context-provider.js");
  hasRe(ctxProvider, /readSession\("mkp_user_companyId"\)/, "context-provider læser company fra session (uændret)");
  hasRe(ctxProvider, /readSession\("mkp_selected_locationId"\)/, "context-provider læser location fra session (uændret)");
  const sessionJs = readPublic("core/session.js");
  hasRe(sessionJs, /localStorage\.setItem\("selectedLocationId"/, "session.js husker valgt lokation i localStorage (uændret)");

  // Drawerens logout må ikke rydde localStorage-preferencen (selectedLocationId),
  // kun afslutte sessionen — ellers mister brugeren sin huskede lokation.
  const logoutBlock = LAYOUT.slice(LAYOUT.indexOf('const logoutBtn = drawer.querySelector("#mkpDrawerLogout")'));
  const logoutEnd = logoutBlock.indexOf("const loginBtn");
  const logout = logoutEnd > 0 ? logoutBlock.slice(0, logoutEnd) : logoutBlock.slice(0, 800);
  assert.ok(!/localStorage\.removeItem|localStorage\.clear/.test(logout),
    "drawerens Log ud sletter ikke localStorage (bevarer husket lokation)");
  assert.ok(!/mkp_selected_locationId|mkp_user_companyId/.test(logout),
    "drawerens Log ud rører ikke context-nøglerne direkte");
});

// ------------------------------------------------------------- CRLF-kontrakt

test("CRLF-kontrakt: regexerne giver samme resultat på LF og CRLF", () => {

  // git checkouter med core.autocrlf=true → en frisk klon har CRLF.
  // Denne test fejler hvis nogen genindfører en \n-følsom regex i denne fil.
  const lf = [
    'const items = [',
    '  {',
    '    key: "dashboard",',
    '    labelKey: "nav.dashboard",',
    '    label: "Dashboard"',
    '  },',
    '  {',
    '    key: "rutiner",',
    '    labelKey: "nav.rutiner",',
    '    label: "Rutiner"',
    '  }',
    '];'
  ].join("\n");
  const crlf = lf.replace(/\n/g, "\r\n");

  const NAV_ITEM_RE = /\r?\n\s+key: "[a-z-]+",\r?\n\s+labelKey?:/g;
  const lfCount = (lf.match(NAV_ITEM_RE) || []).length;
  const crlfCount = (crlf.match(NAV_ITEM_RE) || []).length;
  assert.equal(lfCount, 2, "LF: forventer 2 menupunkter");
  assert.equal(crlfCount, 2, "CRLF: forventer 2 menupunkter");
  assert.equal(lfCount, crlfCount, "LF og CRLF skal give samme antal");

  // Normaliseringen (toLF) skal gøre CRLF-indhold identisk med LF-indhold.
  assert.equal(toLF(crlf), lf, "toLF() konverterer CRLF til LF");
  assert.equal(toLF(lf), lf, "toLF() er idempotent på LF");

  // has() bruger toLF, så et CRLF-emne matches af et LF-nål og omvendt.
  assert.ok(toLF(crlf).includes("key: \"dashboard\","), "CRLF-indhold matcher LF-nål efter normalisering");

  // De faktiske kildefiler må ikke have bevaret \r efter normalisering.
  for (const [name, source] of [["layout.js", LAYOUT], ["style.css", STYLE], ["auth.js", AUTH]]) {
    assert.ok(!source.includes("\r"), `${name} er normaliseret (ingen \\r tilbage)`);
  }
  assert.ok(!toLF(crlf).includes("\r"), "normaliseret CRLF-indhold har ingen \\r");
});
