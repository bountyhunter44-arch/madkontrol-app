/**
 * Madkontrollen - Smart Workflow Transitions Engine
 * Handles automatic prompts and navigation between modules
 */

import { setDashboardLock, setWorkflowPhase, WORKFLOW_PHASES } from './database.js';

/**
 * Smart Prompt Modal
 * Shows contextual prompts for next actions
 */
export const showSmartPrompt = async ({ title, message, icon, actions }) => {
  return new Promise((resolve) => {
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'smart-prompt-modal';
    modal.innerHTML = `
      <div class="smart-prompt-overlay"></div>
      <div class="smart-prompt-content">
        <div class="smart-prompt-icon">${icon}</div>
        <h3 class="smart-prompt-title">${title}</h3>
        <p class="smart-prompt-message">${message}</p>
        <div class="smart-prompt-actions">
          ${actions.map((action, index) => `
            <button 
              class="smart-prompt-btn ${action.primary ? 'primary' : 'secondary'}" 
              data-value="${action.value}"
              ${index === 0 ? 'autofocus' : ''}
            >
              ${action.label}
            </button>
          `).join('')}
        </div>
      </div>
    `;
    
    // Add styles
    const style = document.createElement('style');
    style.textContent = `
      .smart-prompt-modal {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: fadeIn 0.2s ease;
      }
      
      .smart-prompt-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(4px);
      }
      
      .smart-prompt-content {
        position: relative;
        background: #fff;
        border-radius: 20px;
        padding: 32px;
        max-width: 480px;
        width: 90%;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        text-align: center;
        animation: slideUp 0.3s ease;
      }
      
      .smart-prompt-icon {
        font-size: 64px;
        margin-bottom: 16px;
      }
      
      .smart-prompt-title {
        font-size: 24px;
        font-weight: 800;
        color: #111827;
        margin: 0 0 12px;
      }
      
      .smart-prompt-message {
        font-size: 16px;
        color: #6b7280;
        line-height: 1.6;
        margin: 0 0 24px;
      }
      
      .smart-prompt-actions {
        display: flex;
        gap: 12px;
        justify-content: center;
      }
      
      .smart-prompt-btn {
        padding: 14px 24px;
        border-radius: 12px;
        font-size: 16px;
        font-weight: 700;
        cursor: pointer;
        border: none;
        transition: all 0.2s;
      }
      
      .smart-prompt-btn.primary {
        background: #10b981;
        color: #fff;
        box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
      }
      
      .smart-prompt-btn.primary:hover {
        background: #059669;
        transform: translateY(-2px);
        box-shadow: 0 6px 16px rgba(16, 185, 129, 0.4);
      }
      
      .smart-prompt-btn.secondary {
        background: #f3f4f6;
        color: #374151;
      }
      
      .smart-prompt-btn.secondary:hover {
        background: #e5e7eb;
      }
      
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      
      @keyframes slideUp {
        from {
          opacity: 0;
          transform: translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
    `;
    
    document.head.appendChild(style);
    document.body.appendChild(modal);
    
    // Handle button clicks
    modal.querySelectorAll('.smart-prompt-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const value = btn.dataset.value;
        document.body.removeChild(modal);
        document.head.removeChild(style);
        resolve(value);
      });
    });
    
    // Handle overlay click
    modal.querySelector('.smart-prompt-overlay').addEventListener('click', () => {
      document.body.removeChild(modal);
      document.head.removeChild(style);
      resolve(null);
    });
  });
};

/**
 * Transition: Scan In → Temperature Check
 */
export const transitionScanInToTempCheck = async (item) => {
  const shouldCheckTemp = await showSmartPrompt({
    title: "Næste skridt",
    message: `${item.productName} er scannet ind. Vil du udføre varemodtagelses-tjek nu?`,
    icon: "🌡️",
    actions: [
      { label: "Ja, tjek temperatur", value: "yes", primary: true },
      { label: "Spring over", value: "skip" }
    ]
  });
  
  if (shouldCheckTemp === "yes") {
    window.location.href = `/modules/01-core/modtagelse/temp-check.html?itemId=${item.itemId}&autoFill=true`;
  }
};

/**
 * Transition: Deviation Created → Lock Dashboard
 */
export const transitionDeviationToLock = async (db, deviationId, deviationData) => {
  // Lock dashboard
  await setDashboardLock(db, true, "open_deviation", {
    message: `⚠️ Handling kræves: ${deviationData.type}`,
    actionUrl: `/modules/01-core/afvigelser/detail.html?id=${deviationId}`,
    actionLabel: "Løs afvigelse nu"
  });
  
  // Show prompt
  const shouldResolve = await showSmartPrompt({
    title: "Afvigelse registreret",
    message: "Dashboardet er låst indtil afvigelsen er løst. Vil du håndtere den nu?",
    icon: "⚠️",
    actions: [
      { label: "Ja, løs nu", value: "yes", primary: true },
      { label: "Senere", value: "later" }
    ]
  });
  
  if (shouldResolve === "yes") {
    window.location.href = `/modules/01-core/afvigelser/detail.html?id=${deviationId}`;
  }
};

/**
 * Transition: Phase Complete → Next Phase
 */
export const transitionToNextPhase = async (db, userContext, currentPhase) => {
  const phaseOrder = [
    WORKFLOW_PHASES.MODTAGELSE,
    WORKFLOW_PHASES.PRODUKTION,
    WORKFLOW_PHASES.SERVICE,
    WORKFLOW_PHASES.LUK_RAPPORT
  ];
  
  const currentIndex = phaseOrder.indexOf(currentPhase);
  const nextPhase = phaseOrder[currentIndex + 1];
  
  if (!nextPhase) {
    // Last phase completed
    const shouldClose = await showSmartPrompt({
      title: "Dagens opgaver fuldført",
      message: "Alle faser er gennemført. Vil du lukke dagen og generere rapport?",
      icon: "✅",
      actions: [
        { label: "Ja, luk dag", value: "yes", primary: true },
        { label: "Fortsæt arbejde", value: "continue" }
      ]
    });
    
    if (shouldClose === "yes") {
      window.location.href = "/modules/01-core/luk-rapport/luk-dag.html";
    }
    return;
  }
  
  // Move to next phase
  await setWorkflowPhase(db, userContext, nextPhase);
  
  const phaseNames = {
    [WORKFLOW_PHASES.MODTAGELSE]: "Modtagelse",
    [WORKFLOW_PHASES.PRODUKTION]: "Produktion",
    [WORKFLOW_PHASES.SERVICE]: "Service",
    [WORKFLOW_PHASES.LUK_RAPPORT]: "Luk & Rapport"
  };
  
  const phaseIcons = {
    [WORKFLOW_PHASES.MODTAGELSE]: "📦",
    [WORKFLOW_PHASES.PRODUKTION]: "🍳",
    [WORKFLOW_PHASES.SERVICE]: "🍽️",
    [WORKFLOW_PHASES.LUK_RAPPORT]: "🔒"
  };
  
  await showSmartPrompt({
    title: "Fase fuldført!",
    message: `Du er nu klar til: ${phaseNames[nextPhase]}`,
    icon: phaseIcons[nextPhase],
    actions: [
      { label: "Fortsæt", value: "continue", primary: true }
    ]
  });
};

/**
 * Show Dashboard Lock Banner
 */
export const showDashboardLockBanner = (lockData) => {
  const banner = document.createElement('div');
  banner.className = 'dashboard-lock-banner';
  banner.innerHTML = `
    <div class="lock-banner-content">
      <div class="lock-banner-icon">🔒</div>
      <div class="lock-banner-text">
        <h3>Dashboard låst</h3>
        <p>${lockData.message}</p>
      </div>
      <a href="${lockData.actionUrl}" class="lock-banner-action">
        ${lockData.actionLabel}
      </a>
    </div>
  `;
  
  const style = document.createElement('style');
  style.textContent = `
    .dashboard-lock-banner {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 9999;
      background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
      color: #fff;
      padding: 16px 20px;
      box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
      animation: slideDown 0.3s ease;
    }
    
    .lock-banner-content {
      max-width: 1200px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      gap: 16px;
    }
    
    .lock-banner-icon {
      font-size: 32px;
    }
    
    .lock-banner-text {
      flex: 1;
    }
    
    .lock-banner-text h3 {
      margin: 0 0 4px;
      font-size: 18px;
      font-weight: 800;
    }
    
    .lock-banner-text p {
      margin: 0;
      font-size: 14px;
      opacity: 0.9;
    }
    
    .lock-banner-action {
      padding: 12px 24px;
      background: #fff;
      color: #ef4444;
      border-radius: 8px;
      font-weight: 700;
      text-decoration: none;
      transition: all 0.2s;
    }
    
    .lock-banner-action:hover {
      background: #fee2e2;
      transform: translateY(-2px);
    }
    
    @keyframes slideDown {
      from {
        transform: translateY(-100%);
      }
      to {
        transform: translateY(0);
      }
    }
  `;
  
  document.head.appendChild(style);
  document.body.insertBefore(banner, document.body.firstChild);
  
  // Push content down
  document.body.style.paddingTop = '80px';
};

/**
 * Show Success Toast
 */
export const showSuccess = (message) => {
  const toast = document.createElement('div');
  toast.className = 'success-toast';
  toast.textContent = message;
  
  const style = document.createElement('style');
  style.textContent = `
    .success-toast {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: #10b981;
      color: #fff;
      padding: 16px 24px;
      border-radius: 12px;
      font-weight: 700;
      box-shadow: 0 8px 24px rgba(16, 185, 129, 0.3);
      z-index: 10000;
      animation: toastSlide 0.3s ease;
    }
    
    @keyframes toastSlide {
      from {
        transform: translateX(400px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
  `;
  
  document.head.appendChild(style);
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'toastSlide 0.3s ease reverse';
    setTimeout(() => {
      document.body.removeChild(toast);
      document.head.removeChild(style);
    }, 300);
  }, 3000);
};

export default {
  showSmartPrompt,
  transitionScanInToTempCheck,
  transitionDeviationToLock,
  transitionToNextPhase,
  showDashboardLockBanner,
  showSuccess
};
