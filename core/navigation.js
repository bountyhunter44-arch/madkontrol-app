/**
 * Role-Based Navigation Component
 * Shows/hides navigation items based on user role and module permissions
 */

export const NAVIGATION_ITEMS = {
  // Core Egenkontrol (Always visible for all roles)
  CORE: [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: '📊',
      href: '/dashboard',
      roles: ['owner', 'admin', 'employee']
    },
    {
      id: 'rutiner',
      label: 'Rutiner',
      icon: '📋',
      href: '/modules/egenkontrol/rutiner.html',
      roles: ['owner', 'admin', 'employee']
    },
    {
      id: 'afvigelser',
      label: 'Afvigelser',
      icon: '⚠️',
      href: '/modules/egenkontrol/afvigelser.html',
      roles: ['owner', 'admin', 'employee']
    },
    {
      id: 'rapporter',
      label: 'Rapporter',
      icon: '📄',
      href: 'https://madkontrollen.dk/modules/egenkontrol/rapporter.html?mode=authority',
      roles: ['owner', 'admin']
    }
  ],

  // Inventory Module (Requires module permission)
  INVENTORY: [
    {
      id: 'lager-scan',
      label: 'Scan Varer',
      icon: '📦',
      href: '/modules/lager/scanner.html',
      roles: ['owner', 'admin', 'employee'],
      requiresModule: 'inventory'
    },
    {
      id: 'lager-dashboard',
      label: 'Lagerstatus',
      icon: '📊',
      href: '/modules/lager/dashboard.html',
      roles: ['owner', 'admin'],
      requiresModule: 'inventory'
    }
  ],

  // Admin Only
  ADMIN: [
    {
      id: 'profit-balance',
      label: 'Profit-Balance',
      icon: '💰',
      href: '/modules/lager/profit-dashboard.html',
      roles: ['owner', 'admin'],
      requiresModule: 'inventory'
    },
    {
      id: 'personale',
      label: 'Personale',
      icon: '👥',
      href: '/admin/personale.html',
      roles: ['owner', 'admin']
    },
    {
      id: 'regnskab',
      label: 'Regnskab',
      icon: '💼',
      href: '/admin/regnskab.html',
      roles: ['owner'],
      requiresModule: 'accounting'
    }
  ]
};

/**
 * Filter navigation items based on user role and modules
 */
export function getNavigationForUser(userProfile) {
  const { role, modules = {} } = userProfile;
  
  const allItems = [
    ...NAVIGATION_ITEMS.CORE,
    ...NAVIGATION_ITEMS.INVENTORY,
    ...NAVIGATION_ITEMS.ADMIN
  ];

  return allItems.filter(item => {
    // Check role permission
    if (!item.roles.includes(role)) {
      return false;
    }

    // Check module permission
    if (item.requiresModule && !modules[item.requiresModule]) {
      return false;
    }

    return true;
  });
}

/**
 * Render navigation sidebar
 */
export function renderNavigation(userProfile, activeId = null) {
  const items = getNavigationForUser(userProfile);

  const nav = document.createElement('nav');
  nav.className = 'app-navigation';
  nav.setAttribute('aria-label', 'Main navigation');

  // Group items by category
  const coreItems = items.filter(item => NAVIGATION_ITEMS.CORE.includes(item));
  const inventoryItems = items.filter(item => NAVIGATION_ITEMS.INVENTORY.includes(item));
  const adminItems = items.filter(item => NAVIGATION_ITEMS.ADMIN.includes(item));

  let html = '<div class="nav-inner">';

  // Core section
  if (coreItems.length > 0) {
    html += '<div class="nav-section">';
    html += '<div class="nav-label">Egenkontrol</div>';
    html += coreItems.map(item => renderNavItem(item, activeId)).join('');
    html += '</div>';
  }

  // Inventory section
  if (inventoryItems.length > 0) {
    html += '<div class="nav-section">';
    html += '<div class="nav-label">Lager</div>';
    html += inventoryItems.map(item => renderNavItem(item, activeId)).join('');
    html += '</div>';
  }

  // Admin section
  if (adminItems.length > 0) {
    html += '<div class="nav-section">';
    html += '<div class="nav-label">Administration</div>';
    html += adminItems.map(item => renderNavItem(item, activeId)).join('');
    html += '</div>';
  }

  html += '</div>';

  nav.innerHTML = html;
  return nav;
}

function renderNavItem(item, activeId) {
  const isActive = item.id === activeId;
  const activeClass = isActive ? ' active' : '';
  const ariaCurrent = isActive ? ' aria-current="page"' : '';

  return `
    <a href="${item.href}" class="nav-link${activeClass}"${ariaCurrent}>
      <span class="nav-icon">${item.icon}</span>
      <span class="nav-text">${item.label}</span>
    </a>
  `;
}

/**
 * Inject navigation styles
 */
export function injectNavigationStyles() {
  if (document.getElementById('nav-styles')) return;

  const style = document.createElement('style');
  style.id = 'nav-styles';
  style.textContent = `
    .app-navigation {
      width: 260px;
      background: #fff;
      border-right: 1px solid #e5e7eb;
      height: 100vh;
      position: sticky;
      top: 0;
      overflow-y: auto;
    }

    .nav-inner {
      padding: 20px 12px;
    }

    .nav-section {
      margin-bottom: 24px;
    }

    .nav-label {
      padding: 0 12px 8px;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #6b7280;
    }

    .nav-link {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 12px;
      border-radius: 10px;
      text-decoration: none;
      color: #374151;
      font-size: 14px;
      font-weight: 600;
      transition: all 0.15s;
      margin-bottom: 4px;
    }

    .nav-link:hover {
      background: #f3f4f6;
      color: #111827;
    }

    .nav-link.active {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: #fff;
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2);
    }

    .nav-icon {
      font-size: 18px;
      width: 24px;
      text-align: center;
    }

    .nav-text {
      flex: 1;
    }

    @media (max-width: 768px) {
      .app-navigation {
        width: 100%;
        height: auto;
        position: relative;
        border-right: none;
        border-bottom: 1px solid #e5e7eb;
      }

      .nav-inner {
        padding: 12px;
      }

      .nav-section {
        margin-bottom: 16px;
      }
    }
  `;

  document.head.appendChild(style);
}

/**
 * Initialize navigation on page
 */
export function initNavigation(userProfile, activeId = null) {
  injectNavigationStyles();

  const container = document.getElementById('app-navigation-container');
  if (!container) {
    console.warn('Navigation container not found. Add <div id="app-navigation-container"></div> to your page.');
    return;
  }

  const nav = renderNavigation(userProfile, activeId);
  container.appendChild(nav);
}

export default {
  NAVIGATION_ITEMS,
  getNavigationForUser,
  renderNavigation,
  injectNavigationStyles,
  initNavigation
};
