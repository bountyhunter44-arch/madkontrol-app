/**
 * Module lock component.
 * Uses the shared module showcase registry so old deploy-card labels cannot reappear here.
 */

const UPGRADE_CARD_KEYS = ["pos", "lagerkontrol", "bogforing"];
const DISPLAY_NAME_OVERRIDES = {
  pos: "Madkontrollen POS",
  bogforing: "Bogføringsappen"
};

const MODULE_SHOWCASES = {
  pos: {
    key: "pos",
    appKey: "pos",
    activeKeys: ["pos"],
    name: "POS",
    image: "/assets/modules/pos-hero.png",
    imageAlt: "Tablet-kasse med betaling, kvittering og salg",
    landingPage: "/modules/pos/presentation.html",
    entryUrl: "https://madkontrollen-pos.web.app/pos/index.html",
    checkoutModuleKey: "pos",
    priceLabel: "49 kr./md. ekskl. moms",
    teaser: "Kasse, salg, boner, moms og dagsrapporter til en moderne hverdag.",
    features: ["Produkter og hurtig kasse", "Boner, kreditnota og dagsrapport", "Moms og betalingsafstemning", "Kasseafstemning til revisor"]
  },
  lagerkontrol: {
    key: "lagerkontrol",
    appKey: "lagerkontrol",
    activeKeys: ["lagerkontrol"],
    name: "Lagerkontrol",
    image: "/assets/modules/lagerkontrol-hero.png",
    imageAlt: "Lagerhylder, varemodtagelse og scanner",
    landingPage: "/modules/lagerkontrol/presentation.html",
    entryUrl: "/modules/lagerkontrol/index.html",
    checkoutModuleKey: "lagerkontrol",
    priceLabel: "49 kr./md. ekskl. moms",
    teaser: "Varelager, optælling, varemodtagelse og svind med bedre overblik.",
    features: ["Varelager og beholdning", "Optælling og lagerstatus", "Varemodtagelse", "Svind og lagerbevægelser"]
  },
  bogforing: {
    key: "bogforing",
    appKey: "accounting",
    activeKeys: ["bogfoering", "bogforing", "bogføring", "accounting"],
    name: "Bogføringsappen",
    image: "/assets/modules/bogforing-hero.png",
    imageAlt: "Bilag, faktura, moms og bankafstemning",
    landingPage: "/modules/accounting/presentation.html",
    entryUrl: "/modules/accounting/index.html",
    checkoutModuleKey: "bogfoering",
    priceLabel: "49 kr./md. ekskl. moms",
    teaser: "Bilag, banktransaktioner og bogføringsforslag til bedre økonomisk overblik.",
    features: ["Bilag og dokumenter", "Banktransaktioner", "Bogføringsforslag", "Afstemning"]
  }
};

const MOJIBAKE_FIXES = [
  ["Ã¦", "æ"],
  ["Ã¸", "ø"],
  ["Ã¥", "å"],
  ["Ã†", "Æ"],
  ["Ã˜", "Ø"],
  ["Ã…", "Å"],
  ["Ã©", "é"],
  ["Ã¼", "ü"]
];

function cleanText(value) {
  let text = String(value || "");
  MOJIBAKE_FIXES.forEach(([from, to]) => {
    text = text.split(from).join(to);
  });
  return text;
}

function escapeHtml(value) {
  return cleanText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeKey(value) {
  return cleanText(value)
    .trim()
    .toLowerCase()
    .replace(/ø/g, "oe")
    .replace(/å/g, "aa")
    .replace(/æ/g, "ae")
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getActiveModuleKeys(userProfile = {}) {
  const profile = userProfile || {};
  const active = new Set(["core"]);
  const modules = profile.modules && typeof profile.modules === "object"
    ? profile.modules
    : profile;

  if (Array.isArray(profile.activeModules)) {
    profile.activeModules.forEach((key) => active.add(normalizeKey(key)));
  }

  Object.entries(modules || {}).forEach(([key, value]) => {
    const enabled = value === true || value === "true" || value?.active === true || value?.enabled === true;
    if (enabled) active.add(normalizeKey(key));
  });

  return [...active].filter(Boolean);
}

function getShowcaseForModule(moduleName) {
  const normalized = normalizeKey(moduleName);
  return getModuleShowcase(normalized) || getModuleShowcases().find((showcase) => {
    const candidates = [
      showcase.key,
      showcase.appKey,
      showcase.checkoutModuleKey,
      showcase.name,
      ...(showcase.activeKeys || [])
    ];
    return candidates.some((candidate) => normalizeKey(candidate) === normalized);
  }) || null;
}

function getModuleShowcases() {
  return UPGRADE_CARD_KEYS
    .map((key) => MODULE_SHOWCASES[key])
    .filter(Boolean)
    .map((item) => ({
      ...item,
      activeKeys: [...(item.activeKeys || [item.key])]
    }));
}

function getModuleShowcase(keyOrSlug) {
  const normalized = normalizeKey(keyOrSlug);
  return getModuleShowcases().find((item) => {
    const candidates = [item.key, item.appKey, item.checkoutModuleKey, item.name, ...(item.activeKeys || [])];
    return candidates.some((candidate) => normalizeKey(candidate) === normalized);
  }) || null;
}

function moduleIsActive(showcase, activeModules = []) {
  const active = new Set((Array.isArray(activeModules) ? activeModules : [])
    .map((key) => normalizeKey(key))
    .filter(Boolean));
  return (showcase?.activeKeys || [showcase?.key]).some((key) => active.has(normalizeKey(key)));
}

function getModulePurchaseUrl(showcase) {
  const key = showcase?.checkoutModuleKey || "";
  if (showcase?.landingPage) return showcase.landingPage;
  return key ? `/quick-onboarding.html?module=${encodeURIComponent(key)}&selectedModules=${encodeURIComponent(key)}` : "/quick-onboarding.html";
}

function getDisplayName(showcase) {
  return DISPLAY_NAME_OVERRIDES[showcase?.key] || cleanText(showcase?.name || "Modul");
}

export function checkModuleAccess(userProfile = {}, requiredModule) {
  if (normalizeKey(requiredModule) === "core") return true;

  const activeModules = getActiveModuleKeys(userProfile);
  const showcase = getShowcaseForModule(requiredModule);
  if (showcase) return moduleIsActive(showcase, activeModules);

  return activeModules.includes(normalizeKey(requiredModule));
}

export function showModuleLock(moduleName, moduleDescription = "") {
  const showcase = getShowcaseForModule(moduleName);
  const displayName = showcase ? getDisplayName(showcase) : cleanText(moduleName);
  const purchaseUrl = showcase ? getModulePurchaseUrl(showcase) : "/dashboard.html";
  const description = moduleDescription || showcase?.teaser || "Dette modul er ikke aktivt for din virksomhed eller lokation endnu.";

  const lockScreen = document.createElement("div");
  lockScreen.className = "module-lock-screen";
  lockScreen.innerHTML = `
    <div class="module-lock-overlay"></div>
    <div class="module-lock-content">
      <div class="module-lock-kicker">Madkontrollen</div>
      <h2 class="module-lock-title">Modul ikke tilgængeligt</h2>
      <p class="module-lock-description">
        <strong>${escapeHtml(displayName)}</strong> er ikke aktivt i din nuværende adgang.
      </p>
      <p class="module-lock-info">${escapeHtml(description)}</p>

      <div class="module-lock-actions">
        <a href="${escapeHtml(purchaseUrl)}" class="btn btn-primary">Læs mere</a>
        <a href="/dashboard" class="btn btn-secondary">Tilbage til dashboard</a>
      </div>

      <div class="module-lock-features">
        <h3>Det får du med modulet</h3>
        <ul id="module-features-list"></ul>
      </div>
    </div>
  `;

  document.body.appendChild(lockScreen);
  injectStyles();
  populateModuleFeatures(showcase);

  return lockScreen;
}

function populateModuleFeatures(showcase) {
  const featuresList = document.getElementById("module-features-list");
  if (!featuresList) return;

  const features = Array.isArray(showcase?.features) && showcase.features.length
    ? showcase.features
    : ["Samlet moduloverblik", "Rapporter og daglige arbejdsgange", "Adgang for virksomhed og lokation"];

  featuresList.innerHTML = features
    .map((feature) => `<li>${escapeHtml(feature)}</li>`)
    .join("");
}

export function hideUnpurchasedModules(userProfile = {}) {
  const navItems = document.querySelectorAll("[data-requires-module]");

  navItems.forEach((item) => {
    const requiredModule = item.dataset.requiresModule;
    item.style.display = checkModuleAccess(userProfile, requiredModule) ? "" : "none";
  });

  const upgradeContainer = document.getElementById("upgrade-modules-container");
  if (upgradeContainer) {
    renderUpgradeCards(upgradeContainer, userProfile);
  }
}

function renderUpgradeCards(container, userProfile = {}) {
  const activeModules = getActiveModuleKeys(userProfile);
  const modules = UPGRADE_CARD_KEYS
    .map((key) => getModuleShowcase(key))
    .filter(Boolean)
    .filter((showcase) => !moduleIsActive(showcase, activeModules));

  if (!modules.length) {
    container.innerHTML = '<p class="upgrade-empty">Alle tilgængelige moduler er aktive.</p>';
    return;
  }

  container.innerHTML = `
    <div class="upgrade-cards-grid">
      ${modules.map(renderUpgradeCard).join("")}
    </div>
  `;

  injectUpgradeStyles();
}

function renderUpgradeCard(showcase) {
  const title = getDisplayName(showcase);
  const teaser = cleanText(showcase.teaser || showcase.subheading || "");
  const price = cleanText(showcase.priceLabel || "");
  const image = showcase.image || "";
  const imageAlt = cleanText(showcase.imageAlt || title);
  const purchaseUrl = getModulePurchaseUrl(showcase);

  return `
    <article class="upgrade-card">
      <a class="upgrade-card-image-link" href="${escapeHtml(purchaseUrl)}" aria-label="${escapeHtml(title)}">
        <img class="upgrade-card-image" src="${escapeHtml(image)}" alt="${escapeHtml(imageAlt)}" loading="lazy">
      </a>
      <div class="upgrade-card-body">
        <h4 class="upgrade-card-title">${escapeHtml(title)}</h4>
        <p class="upgrade-card-description">${escapeHtml(teaser)}</p>
        <div class="upgrade-card-footer">
          <span class="upgrade-card-price">${escapeHtml(price)}</span>
          <a href="${escapeHtml(purchaseUrl)}" class="btn btn-primary btn-sm">Læs mere</a>
        </div>
      </div>
    </article>
  `;
}

function injectStyles() {
  if (document.getElementById("module-lock-styles")) return;

  const style = document.createElement("style");
  style.id = "module-lock-styles";
  style.textContent = `
    .module-lock-screen {
      position: fixed;
      inset: 0;
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    .module-lock-overlay {
      position: absolute;
      inset: 0;
      background: rgba(8, 16, 24, 0.7);
      backdrop-filter: blur(8px);
    }

    .module-lock-content {
      position: relative;
      max-width: 600px;
      width: 100%;
      background: #fff;
      border-radius: 14px;
      padding: 34px;
      text-align: left;
      box-shadow: 0 20px 60px rgba(8, 16, 24, 0.28);
      max-height: 90vh;
      overflow-y: auto;
    }

    .module-lock-kicker {
      margin-bottom: 10px;
      font-size: 13px;
      font-weight: 800;
      letter-spacing: .08em;
      text-transform: uppercase;
      color: #15803d;
    }

    .module-lock-title {
      margin: 0 0 12px;
      font-size: 28px;
      color: #0f172a;
    }

    .module-lock-description {
      margin: 0 0 8px;
      font-size: 16px;
      color: #334155;
    }

    .module-lock-info {
      margin: 0 0 28px;
      font-size: 14px;
      color: #64748b;
      line-height: 1.6;
    }

    .module-lock-actions {
      display: flex;
      gap: 12px;
      margin-bottom: 28px;
      flex-wrap: wrap;
    }

    .module-lock-features {
      padding: 20px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
    }

    .module-lock-features h3 {
      margin: 0 0 14px;
      font-size: 17px;
      color: #0f172a;
    }

    .module-lock-features ul {
      margin: 0;
      padding-left: 18px;
    }

    .module-lock-features li {
      margin-bottom: 10px;
      font-size: 14px;
      color: #334155;
      line-height: 1.5;
    }

    @media (max-width: 640px) {
      .module-lock-content {
        padding: 24px;
      }

      .module-lock-actions {
        flex-direction: column;
      }
    }
  `;

  document.head.appendChild(style);
}

function injectUpgradeStyles() {
  if (document.getElementById("upgrade-cards-styles")) return;

  const style = document.createElement("style");
  style.id = "upgrade-cards-styles";
  style.textContent = `
    .upgrade-cards-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 18px;
      margin-top: 18px;
    }

    .upgrade-card {
      overflow: hidden;
      background: #fff;
      border: 1px solid #dbe7dd;
      border-radius: 12px;
      box-shadow: 0 12px 28px rgba(15, 23, 42, 0.08);
    }

    .upgrade-card-image-link {
      display: block;
      aspect-ratio: 16 / 9;
      background: #edf7ef;
      overflow: hidden;
    }

    .upgrade-card-image {
      width: 100%;
      height: 100%;
      display: block;
      object-fit: cover;
    }

    .upgrade-card-body {
      padding: 16px;
    }

    .upgrade-card-title {
      margin: 0 0 8px;
      font-size: 18px;
      color: #0f172a;
    }

    .upgrade-card-description {
      margin: 0 0 14px;
      min-height: 46px;
      font-size: 14px;
      color: #64748b;
      line-height: 1.45;
    }

    .upgrade-card-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .upgrade-card-price {
      color: #15803d;
      font-weight: 800;
      font-size: 15px;
    }

    .upgrade-empty {
      color: #64748b;
      text-align: center;
      margin: 14px 0 0;
    }

    .btn-sm {
      padding: 9px 14px;
      font-size: 14px;
      white-space: nowrap;
    }

    @media (max-width: 640px) {
      .upgrade-cards-grid {
        grid-template-columns: 1fr;
      }

      .upgrade-card-footer {
        align-items: flex-start;
        flex-direction: column;
      }
    }
  `;

  document.head.appendChild(style);
}

export default {
  checkModuleAccess,
  showModuleLock,
  hideUnpurchasedModules
};
