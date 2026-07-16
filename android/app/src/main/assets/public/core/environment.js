/**
 * Environment Detection and Configuration
 * Determines if app is running in development or production
 */

window.MKP = window.MKP || {};

window.MKP.Environment = (function() {
  'use strict';

  /**
   * Detect environment based on hostname
   */
  function detectEnvironment() {
    const hostname = window.location.hostname;
    
    // Production domains
    const productionDomains = [
      'madkontrollen.dk',
      'www.madkontrollen.dk',
      'madkontrollen.web.app',
      'madkontrollen.firebaseapp.com'
    ];
    
    // Check if current hostname is production
    const isProduction = productionDomains.some(domain => 
      hostname === domain || hostname.endsWith('.' + domain)
    );
    
    // Development: localhost, 127.0.0.1, or any other domain
    const isDevelopment = hostname === 'localhost' || 
                          hostname === '127.0.0.1' || 
                          hostname.startsWith('192.168.') ||
                          hostname.endsWith('.local') ||
                          !isProduction;
    
    return {
      isProduction,
      isDevelopment,
      hostname
    };
  }

  /**
   * Check if user has developer/superadmin role
   */
  function isDeveloperUser(userData) {
    if (!userData) return false;
    
    const developerEmails = [
      'developer@madkontrollen.dk',
      'admin@madkontrollen.dk',
      'superadmin@madkontrollen.dk'
    ];
    
    // Check email
    if (userData.email && developerEmails.includes(userData.email.toLowerCase())) {
      return true;
    }
    
    // Check role
    if (userData.role === 'developer' || userData.role === 'superadmin') {
      return true;
    }
    
    // Check custom claims
    if (userData.isDeveloper === true || userData.isSuperAdmin === true) {
      return true;
    }
    
    return false;
  }

  /**
   * Check if dangerous operations are allowed
   */
  function canPerformDangerousOperations(userData) {
    const env = detectEnvironment();
    
    // NEVER allow in production, regardless of user
    if (env.isProduction) {
      console.warn('🚫 Dangerous operations are BLOCKED in production');
      return false;
    }
    
    // In development, only allow for developer users
    if (env.isDevelopment) {
      const isDev = isDeveloperUser(userData);
      if (!isDev) {
        console.warn('🚫 Dangerous operations require developer/superadmin role');
      }
      return isDev;
    }
    
    return false;
  }

  /**
   * Show environment badge in UI
   */
  function showEnvironmentBadge() {
    const env = detectEnvironment();
    
    if (env.isDevelopment) {
      const badge = document.createElement('div');
      badge.id = 'env-badge';
      badge.style.cssText = `
        position: fixed;
        bottom: 10px;
        right: 10px;
        padding: 8px 16px;
        background: #ff9800;
        color: #fff;
        font-size: 12px;
        font-weight: 700;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        z-index: 9999;
        font-family: 'Inter', sans-serif;
      `;
      badge.textContent = '🔧 DEVELOPMENT MODE';
      document.body.appendChild(badge);
    }
  }

  /**
   * Log environment info
   */
  function logEnvironmentInfo() {
    const env = detectEnvironment();
    console.log('🌍 Environment:', env.isProduction ? 'PRODUCTION' : 'DEVELOPMENT');
    console.log('🌐 Hostname:', env.hostname);
  }

  // Initialize
  const env = detectEnvironment();
  
  // Show badge if development
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      showEnvironmentBadge();
      logEnvironmentInfo();
    });
  } else {
    showEnvironmentBadge();
    logEnvironmentInfo();
  }

  // Public API
  return {
    isProduction: () => env.isProduction,
    isDevelopment: () => env.isDevelopment,
    getHostname: () => env.hostname,
    isDeveloperUser,
    canPerformDangerousOperations,
    detectEnvironment
  };

})();
