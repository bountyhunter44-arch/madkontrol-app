/**
 * Impersonation Module for Super-Admin
 * Allows super-admin to view dashboard as any company
 */

export function isImpersonating() {
  return sessionStorage.getItem('mkp_impersonate_active') === 'true';
}

export function getImpersonatedCompanyId() {
  return sessionStorage.getItem('mkp_impersonate_companyId');
}

export function getImpersonatedCompanyName() {
  return sessionStorage.getItem('mkp_impersonate_companyName');
}

export function startImpersonation(companyId, companyName) {
  sessionStorage.setItem('mkp_impersonate_companyId', companyId);
  sessionStorage.setItem('mkp_impersonate_companyName', companyName);
  sessionStorage.setItem('mkp_impersonate_active', 'true');
}

export function stopImpersonation() {
  sessionStorage.removeItem('mkp_impersonate_companyId');
  sessionStorage.removeItem('mkp_impersonate_companyName');
  sessionStorage.removeItem('mkp_impersonate_active');
}

export function renderImpersonationBanner() {
  if (!isImpersonating()) return;

  const companyName = getImpersonatedCompanyName();
  
  // Remove existing banner if present
  const existing = document.getElementById('impersonation-banner');
  if (existing) existing.remove();

  // Create banner
  const banner = document.createElement('div');
  banner.id = 'impersonation-banner';
  banner.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
    color: white;
    padding: 12px 20px;
    z-index: 9999;
    display: flex;
    justify-content: space-between;
    align-items: center;
    box-shadow: 0 4px 12px rgba(124, 58, 237, 0.3);
    font-family: Inter, sans-serif;
  `;

  banner.innerHTML = `
    <div style="display: flex; align-items: center; gap: 12px;">
      <span style="font-size: 20px;">👁️</span>
      <div>
        <strong style="font-size: 14px;">Super-Admin Mode</strong>
        <div style="font-size: 12px; opacity: 0.9;">
          Du ser dashboardet som: <strong>${companyName}</strong>
        </div>
      </div>
    </div>
    <button id="stop-impersonation-btn" style="
      background: rgba(255,255,255,0.2);
      border: 1px solid rgba(255,255,255,0.3);
      color: white;
      padding: 8px 16px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.2s;
    ">
      ← Tilbage til Owner Dashboard
    </button>
  `;

  document.body.insertBefore(banner, document.body.firstChild);

  // Adjust body padding to account for banner
  document.body.style.paddingTop = '60px';

  // Add event listener
  document.getElementById('stop-impersonation-btn').addEventListener('click', () => {
    stopImpersonation();
    window.location.href = '/admin/owner-dashboard.html';
  });
}

export function getEffectiveCompanyId(userCompanyId) {
  if (isImpersonating()) {
    return getImpersonatedCompanyId();
  }
  return userCompanyId;
}

export function getEffectiveLocationId(userLocationId) {
  // When impersonating, we might need to load the first location of the company
  // For now, return the user's location or impersonated company's first location
  if (isImpersonating()) {
    // This should be loaded from the company's locations
    return sessionStorage.getItem('mkp_impersonate_locationId') || userLocationId;
  }
  return userLocationId;
}
