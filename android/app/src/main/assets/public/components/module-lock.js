/**
 * Module Lock Component
 * Shows upgrade prompts for unpurchased modules
 */

export function checkModuleAccess(userProfile, requiredModule) {
  const { modules = {} } = userProfile;
  
  // Core module is always available
  if (requiredModule === 'core') {
    return true;
  }
  
  return modules[requiredModule] === true;
}

export function showModuleLock(moduleName, moduleDescription) {
  const lockScreen = document.createElement('div');
  lockScreen.className = 'module-lock-screen';
  lockScreen.innerHTML = `
    <div class="module-lock-overlay"></div>
    <div class="module-lock-content">
      <div class="module-lock-icon">🔒</div>
      <h2 class="module-lock-title">Modul ikke tilgængeligt</h2>
      <p class="module-lock-description">
        <strong>${moduleName}</strong> er ikke inkluderet i din nuværende plan.
      </p>
      <p class="module-lock-info">${moduleDescription}</p>
      
      <div class="module-lock-actions">
        <a href="/upgrade?module=${moduleName.toLowerCase()}" class="btn btn-primary">
          Opgrader nu
        </a>
        <a href="/dashboard" class="btn btn-secondary">
          Tilbage til dashboard
        </a>
      </div>

      <div class="module-lock-features">
        <h3>Hvad får du med dette modul?</h3>
        <ul id="module-features-list"></ul>
      </div>
    </div>
  `;

  document.body.appendChild(lockScreen);
  injectStyles();

  // Populate features based on module
  populateModuleFeatures(moduleName);

  return lockScreen;
}

function populateModuleFeatures(moduleName) {
  const featuresList = document.getElementById('module-features-list');
  if (!featuresList) return;

  const features = {
    'Lager & Stregkode': [
      '📦 Mobil stregkode-scanner til varemodtagelse',
      '🔄 FIFO (First In, First Out) advarsler',
      '📅 Automatisk udløbsdato tracking',
      '💰 Profit-Balance Dashboard',
      '📊 Lager-status og beholdning',
      '🌡️ Integration med temperaturkontrol'
    ],
    'Regnskab': [
      '💼 Automatisk omkostningsberegning',
      '📈 Profit & Loss rapporter',
      '💳 Faktura-håndtering',
      '📊 Økonomiske dashboards',
      '🔍 Udgifts-tracking',
      '📅 Månedlige rapporter'
    ],
    'Institution': [
      '🏫 Skole-specifikke rutiner',
      '👶 Allergi-håndtering',
      '📋 Portionsstørrelser',
      '🍽️ Menu-planlægning',
      '📊 Ernærings-tracking',
      '👥 Elev-administration'
    ],
    'Menu Design': [
      '📝 Digital menu-editor',
      '🖼️ Billede-upload til retter',
      '💰 Pris-kalkulation',
      '🔄 Sæson-menuer',
      '📱 QR-kode menuer',
      '🌍 Multi-sprog support'
    ]
  };

  const moduleFeatures = features[moduleName] || [
    '✨ Avancerede funktioner',
    '📊 Detaljerede rapporter',
    '🔧 Professionelle værktøjer',
    '📈 Forbedret produktivitet'
  ];

  featuresList.innerHTML = moduleFeatures.map(feature => `<li>${feature}</li>`).join('');
}

export function hideUnpurchasedModules(userProfile) {
  const { modules = {} } = userProfile;

  // Hide navigation items for unpurchased modules
  const navItems = document.querySelectorAll('[data-requires-module]');
  
  navItems.forEach(item => {
    const requiredModule = item.dataset.requiresModule;
    
    if (!modules[requiredModule]) {
      item.style.display = 'none';
    }
  });

  // Add upgrade cards for unpurchased modules on dashboard
  const upgradeContainer = document.getElementById('upgrade-modules-container');
  if (upgradeContainer) {
    renderUpgradeCards(upgradeContainer, modules);
  }
}

function renderUpgradeCards(container, modules) {
  const availableModules = [
    {
      id: 'inventory',
      name: 'Lager & Stregkode',
      icon: '📦',
      description: 'Intelligent lagerstyring med FIFO og profit-tracking',
      price: '299 kr/md'
    },
    {
      id: 'accounting',
      name: 'Regnskab',
      icon: '💼',
      description: 'Automatisk omkostningsberegning og økonomiske rapporter',
      price: '399 kr/md'
    },
    {
      id: 'institutional',
      name: 'Institution',
      icon: '🏫',
      description: 'Skole-specifikke funktioner og allergi-håndtering',
      price: '349 kr/md'
    },
    {
      id: 'menu',
      name: 'Menu Design',
      icon: '📝',
      description: 'Digital menu-editor med billeder og pris-kalkulation',
      price: '199 kr/md'
    }
  ];

  const unpurchasedModules = availableModules.filter(m => !modules[m.id]);

  if (unpurchasedModules.length === 0) {
    container.innerHTML = '<p style="color:#6b7280; text-align:center;">Du har adgang til alle moduler! 🎉</p>';
    return;
  }

  container.innerHTML = `
    <div class="upgrade-cards-grid">
      ${unpurchasedModules.map(module => `
        <div class="upgrade-card">
          <div class="upgrade-card-icon">${module.icon}</div>
          <h4 class="upgrade-card-title">${module.name}</h4>
          <p class="upgrade-card-description">${module.description}</p>
          <div class="upgrade-card-price">${module.price}</div>
          <a href="/upgrade?module=${module.id}" class="btn btn-primary btn-sm">
            Tilføj modul
          </a>
        </div>
      `).join('')}
    </div>
  `;

  injectUpgradeStyles();
}

function injectStyles() {
  if (document.getElementById('module-lock-styles')) return;

  const style = document.createElement('style');
  style.id = 'module-lock-styles';
  style.textContent = `
    .module-lock-screen {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    .module-lock-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(8px);
    }

    .module-lock-content {
      position: relative;
      max-width: 600px;
      width: 100%;
      background: #fff;
      border-radius: 20px;
      padding: 40px;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      max-height: 90vh;
      overflow-y: auto;
    }

    .module-lock-icon {
      font-size: 64px;
      margin-bottom: 20px;
    }

    .module-lock-title {
      margin: 0 0 12px;
      font-size: 28px;
      color: #111827;
    }

    .module-lock-description {
      margin: 0 0 8px;
      font-size: 16px;
      color: #374151;
    }

    .module-lock-info {
      margin: 0 0 32px;
      font-size: 14px;
      color: #6b7280;
      line-height: 1.6;
    }

    .module-lock-actions {
      display: flex;
      gap: 12px;
      justify-content: center;
      margin-bottom: 32px;
    }

    .module-lock-features {
      text-align: left;
      padding: 24px;
      background: #f9fafb;
      border-radius: 12px;
    }

    .module-lock-features h3 {
      margin: 0 0 16px;
      font-size: 18px;
      color: #111827;
    }

    .module-lock-features ul {
      margin: 0;
      padding-left: 0;
      list-style: none;
    }

    .module-lock-features li {
      margin-bottom: 12px;
      font-size: 14px;
      color: #374151;
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
  if (document.getElementById('upgrade-cards-styles')) return;

  const style = document.createElement('style');
  style.id = 'upgrade-cards-styles';
  style.textContent = `
    .upgrade-cards-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 20px;
      margin-top: 20px;
    }

    .upgrade-card {
      background: #fff;
      border: 2px dashed #d1d5db;
      border-radius: 16px;
      padding: 24px;
      text-align: center;
      transition: all 0.2s;
    }

    .upgrade-card:hover {
      border-color: #10b981;
      border-style: solid;
      box-shadow: 0 8px 20px rgba(16, 185, 129, 0.15);
    }

    .upgrade-card-icon {
      font-size: 48px;
      margin-bottom: 16px;
    }

    .upgrade-card-title {
      margin: 0 0 8px;
      font-size: 18px;
      color: #111827;
    }

    .upgrade-card-description {
      margin: 0 0 16px;
      font-size: 14px;
      color: #6b7280;
      line-height: 1.5;
    }

    .upgrade-card-price {
      margin-bottom: 16px;
      font-size: 24px;
      font-weight: 700;
      color: #10b981;
    }

    .btn-sm {
      padding: 10px 20px;
      font-size: 14px;
    }

    @media (max-width: 640px) {
      .upgrade-cards-grid {
        grid-template-columns: 1fr;
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
