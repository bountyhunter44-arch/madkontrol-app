/**
 * Process Dashboard Integration
 * Handles loading and rendering of active process instances
 */

(function() {
  'use strict';

  // Wait for Firebase and MKP to be ready
  function waitForDependencies() {
    return new Promise((resolve) => {
      const check = () => {
        if (window.firebase && window.MKP && window.MKP.ProcessInstances) {
          resolve();
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });
  }

  /**
   * Initialize process dashboard
   */
  async function init() {
    await waitForDependencies();
    
    // Load active processes on page load
    await loadAndRenderActiveProcesses();
    
    // Setup start cooling button
    setupStartCoolingButton();
    
    // Refresh every 30 seconds
    setInterval(loadAndRenderActiveProcesses, 30000);
  }

  /**
   * Load and render active process instances
   */
  async function loadAndRenderActiveProcesses() {
    try {
      const processes = await window.MKP.ProcessInstances.loadActiveProcessInstances();
      
      const container = document.getElementById('active-processes-section');
      const listContainer = document.getElementById('active-processes-list');
      
      if (!container || !listContainer) {
        console.warn('Active processes containers not found');
        return;
      }
      
      if (processes.length > 0) {
        container.style.display = 'block';
        renderActiveProcesses(processes, listContainer);
      } else {
        container.style.display = 'none';
      }
    } catch (error) {
      console.error('Failed to load active processes:', error);
    }
  }

  /**
   * Render active processes
   */
  function renderActiveProcesses(processes, container) {
    container.innerHTML = '';
    
    processes.forEach(process => {
      const card = createProcessCard(process);
      container.appendChild(card);
    });
  }

  /**
   * Create process card element
   */
  function createProcessCard(process) {
    const card = document.createElement('div');
    card.className = 'process-card';
    card.dataset.processId = process.id;
    card.dataset.processType = process.processType;
    
    if (process.processType === 'cooling') {
      card.innerHTML = createCoolingCardHTML(process);
      attachCoolingCardHandlers(card, process);
    } else if (process.processType === 'reheating') {
      card.innerHTML = createReheatingCardHTML(process);
      attachReheatingCardHandlers(card, process);
    }
    
    return card;
  }

  /**
   * Create cooling card HTML
   */
  function createCoolingCardHTML(process) {
    const duration = window.MKP.ProcessInstances.calculateDuration(process.startedAt);
    const remaining = window.MKP.ProcessInstances.calculateRemaining(process.startedAt, 4);
    const progress = window.MKP.ProcessInstances.calculateProgress(process);
    const startTime = window.MKP.ProcessInstances.formatTime(process.startedAt);
    
    const isOverdue = remaining.includes('⚠️');
    
    return `
      <div class="process-card-header">
        <div class="process-card-icon">🧊</div>
        <div class="process-card-title-wrap">
          <h3 class="process-card-title">Nedkøling i gang</h3>
          <span class="process-card-status ${process.status === 'failed' ? 'status-failed' : 'status-active'}">
            ${process.status === 'failed' ? 'Fejlet' : 'Aktiv'}
          </span>
        </div>
      </div>
      
      <div class="process-card-body">
        <div class="process-card-product">
          <strong>${escapeHtml(process.productName)}</strong>
          ${process.batchSize ? ` - ${escapeHtml(process.batchSize)}` : ''}
        </div>
        
        <div class="process-card-info">
          <div class="process-info-row">
            <span class="process-info-label">Startet:</span>
            <span class="process-info-value">${startTime} (${process.startTemperature}°C)</span>
          </div>
          <div class="process-info-row">
            <span class="process-info-label">Forløbet tid:</span>
            <span class="process-info-value">${duration}</span>
          </div>
          <div class="process-info-row ${isOverdue ? 'text-danger' : ''}">
            <span class="process-info-label">Resterende:</span>
            <span class="process-info-value">${remaining}</span>
          </div>
        </div>
        
        <div class="process-progress-bar">
          <div class="process-progress-fill" style="width: ${progress}%"></div>
        </div>
        
        ${process.status === 'failed' ? `
          <div class="process-card-alert">
            ⚠️ Nedkøling fejlet - vælg handling nedenfor
          </div>
        ` : ''}
        
        <div class="process-card-actions">
          ${process.status !== 'failed' ? `
            <button class="btn btn-secondary btn-add-measurement" data-process-id="${process.id}">
              Tilføj måling
            </button>
            <button class="btn btn-primary btn-complete-cooling" data-process-id="${process.id}">
              Afslut nedkøling
            </button>
          ` : `
            <button class="btn btn-primary btn-recovery-reheating" data-process-id="${process.id}">
              🔥 Genopvarm til 75°C
            </button>
            <button class="btn btn-danger btn-recovery-disposal" data-process-id="${process.id}">
              🗑️ Kassér varen
            </button>
          `}
        </div>
      </div>
    `;
  }

  /**
   * Create reheating card HTML
   */
  function createReheatingCardHTML(process) {
    const startTime = window.MKP.ProcessInstances.formatTime(process.startedAt);
    
    return `
      <div class="process-card-header">
        <div class="process-card-icon">🔥</div>
        <div class="process-card-title-wrap">
          <h3 class="process-card-title">Genopvarmning i gang</h3>
          <span class="process-card-status status-critical">Kritisk</span>
        </div>
      </div>
      
      <div class="process-card-body">
        <div class="process-card-product">
          <strong>${escapeHtml(process.productName)}</strong>
          ${process.batchSize ? ` - ${escapeHtml(process.batchSize)}` : ''}
        </div>
        
        <div class="process-card-info">
          <div class="process-info-row">
            <span class="process-info-label">Startet:</span>
            <span class="process-info-value">${startTime} (${process.startTemperature}°C)</span>
          </div>
          <div class="process-info-row">
            <span class="process-info-label">Mål:</span>
            <span class="process-info-value">Min. 75°C i centrum</span>
          </div>
        </div>
        
        <div class="process-card-alert">
          ⚠️ VIGTIGT: Mål temperatur i CENTRUM af fødevaren
        </div>
        
        <div class="process-card-actions">
          <button class="btn btn-primary btn-complete-reheating" data-process-id="${process.id}">
            Afslut genopvarmning
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Attach cooling card handlers
   */
  function attachCoolingCardHandlers(card, process) {
    // Add measurement
    const addMeasurementBtn = card.querySelector('.btn-add-measurement');
    if (addMeasurementBtn) {
      addMeasurementBtn.addEventListener('click', () => showAddMeasurementModal(process));
    }
    
    // Complete cooling
    const completeCoolingBtn = card.querySelector('.btn-complete-cooling');
    if (completeCoolingBtn) {
      completeCoolingBtn.addEventListener('click', () => showCompleteCoolingModal(process));
    }
    
    // Recovery - reheating
    const reheatingBtn = card.querySelector('.btn-recovery-reheating');
    if (reheatingBtn) {
      reheatingBtn.addEventListener('click', () => handleRecoveryReheating(process));
    }
    
    // Recovery - disposal
    const disposalBtn = card.querySelector('.btn-recovery-disposal');
    if (disposalBtn) {
      disposalBtn.addEventListener('click', () => handleRecoveryDisposal(process));
    }
  }

  /**
   * Attach reheating card handlers
   */
  function attachReheatingCardHandlers(card, process) {
    const completeBtn = card.querySelector('.btn-complete-reheating');
    if (completeBtn) {
      completeBtn.addEventListener('click', () => showCompleteReheatingModal(process));
    }
  }

  /**
   * Setup start cooling button
   */
  function setupStartCoolingButton() {
    const btn = document.getElementById('btn-start-cooling');
    if (btn) {
      btn.addEventListener('click', showStartCoolingModal);
    }
  }

  /**
   * Show start cooling modal
   */
  function showStartCoolingModal() {
    const modal = createModal('Start nedkøling', `
      <form id="form-start-cooling">
        <div class="form-group">
          <label for="cooling-product-name">Produkt *</label>
          <input type="text" id="cooling-product-name" class="form-control" required 
                 placeholder="F.eks. Kyllingebryst (stegt)">
        </div>
        
        <div class="form-group">
          <label for="cooling-batch-size">Mængde</label>
          <input type="text" id="cooling-batch-size" class="form-control" 
                 placeholder="F.eks. 2.5 kg">
        </div>
        
        <div class="form-group">
          <label for="cooling-container">Beholder</label>
          <input type="text" id="cooling-container" class="form-control" 
                 placeholder="F.eks. Gastronorm 1/1">
        </div>
        
        <div class="form-group">
          <label for="cooling-start-temp">Starttemperatur (°C) *</label>
          <input type="number" id="cooling-start-temp" class="form-control" required 
                 min="56" step="0.1" placeholder="Min. 56°C">
        </div>
        
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary modal-close">Annuller</button>
          <button type="submit" class="btn btn-primary">Start nedkøling</button>
        </div>
      </form>
    `);
    
    const form = modal.querySelector('#form-start-cooling');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const productName = document.getElementById('cooling-product-name').value;
      const batchSize = document.getElementById('cooling-batch-size').value;
      const container = document.getElementById('cooling-container').value;
      const startTemperature = parseFloat(document.getElementById('cooling-start-temp').value);
      
      if (startTemperature < 56) {
        alert('Starttemperatur skal være mindst 56°C');
        return;
      }
      
      try {
        await window.MKP.ProcessInstances.startCoolingProcess({
          productName,
          batchSize,
          container,
          startTemperature
        });
        
        closeModal(modal);
        await loadAndRenderActiveProcesses();
      } catch (error) {
        console.error('Failed to start cooling:', error);
        alert('Fejl ved start af nedkøling: ' + error.message);
      }
    });
  }

  /**
   * Show add measurement modal
   */
  function showAddMeasurementModal(process) {
    const modal = createModal('Tilføj måling', `
      <form id="form-add-measurement">
        <div class="form-group">
          <label for="measurement-temp">Temperatur (°C) *</label>
          <input type="number" id="measurement-temp" class="form-control" required 
                 step="0.1" placeholder="Nuværende temperatur">
        </div>
        
        <div class="form-group">
          <label for="measurement-note">Note</label>
          <textarea id="measurement-note" class="form-control" rows="2" 
                    placeholder="F.eks. Efter 1 time"></textarea>
        </div>
        
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary modal-close">Annuller</button>
          <button type="submit" class="btn btn-primary">Tilføj måling</button>
        </div>
      </form>
    `);
    
    const form = modal.querySelector('#form-add-measurement');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const temperature = parseFloat(document.getElementById('measurement-temp').value);
      const note = document.getElementById('measurement-note').value;
      
      try {
        await window.MKP.ProcessInstances.addCoolingMeasurement({
          processId: process.id,
          temperature,
          note
        });
        
        closeModal(modal);
        await loadAndRenderActiveProcesses();
      } catch (error) {
        console.error('Failed to add measurement:', error);
        alert('Fejl ved tilføjelse af måling: ' + error.message);
      }
    });
  }

  /**
   * Show complete cooling modal
   */
  function showCompleteCoolingModal(process) {
    const modal = createModal('Afslut nedkøling', `
      <form id="form-complete-cooling">
        <div class="form-group">
          <label for="cooling-end-temp">Sluttemperatur (°C) *</label>
          <input type="number" id="cooling-end-temp" class="form-control" required 
                 step="0.1" placeholder="Målt temperatur">
          <small class="form-text">Mål: Max 10°C inden for 4 timer</small>
        </div>
        
        <div class="form-group">
          <label for="cooling-end-note">Note</label>
          <textarea id="cooling-end-note" class="form-control" rows="2" 
                    placeholder="Eventuelle bemærkninger"></textarea>
        </div>
        
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary modal-close">Annuller</button>
          <button type="submit" class="btn btn-primary">Afslut nedkøling</button>
        </div>
      </form>
    `);
    
    const form = modal.querySelector('#form-complete-cooling');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const endTemperature = parseFloat(document.getElementById('cooling-end-temp').value);
      const note = document.getElementById('cooling-end-note').value;
      
      try {
        const result = await window.MKP.ProcessInstances.completeCoolingProcess({
          processId: process.id,
          endTemperature,
          note
        });
        
        closeModal(modal);
        
        if (result.requiresRecovery) {
          // Show recovery options - will be handled by the failed state in the card
          await loadAndRenderActiveProcesses();
        } else {
          // Success - process completed
          await loadAndRenderActiveProcesses();
          alert('✅ Nedkøling gennemført succesfuldt!');
        }
      } catch (error) {
        console.error('Failed to complete cooling:', error);
        alert('Fejl ved afslutning af nedkøling: ' + error.message);
      }
    });
  }

  /**
   * Handle recovery - reheating
   */
  async function handleRecoveryReheating(process) {
    if (!confirm(`Start genopvarmning af ${process.productName}?\n\nVaren skal genopvarmes til min. 75°C i centrum.`)) {
      return;
    }
    
    try {
      await window.MKP.ProcessInstances.startReheatingProcess({
        failedCoolingProcessId: process.id
      });
      
      await loadAndRenderActiveProcesses();
      alert('✅ Genopvarmning startet');
    } catch (error) {
      console.error('Failed to start reheating:', error);
      alert('Fejl ved start af genopvarmning: ' + error.message);
    }
  }

  /**
   * Handle recovery - disposal
   */
  async function handleRecoveryDisposal(process) {
    const reason = prompt(`Kassér ${process.productName}?\n\nAngiv årsag til kassation:`);
    
    if (!reason) {
      return;
    }
    
    try {
      await window.MKP.ProcessInstances.disposeCoolingProcess({
        processId: process.id,
        disposalReason: reason
      });
      
      await loadAndRenderActiveProcesses();
      alert('✅ Vare kasseret og dokumenteret');
    } catch (error) {
      console.error('Failed to dispose:', error);
      alert('Fejl ved kassation: ' + error.message);
    }
  }

  /**
   * Show complete reheating modal
   */
  function showCompleteReheatingModal(process) {
    const modal = createModal('Afslut genopvarmning', `
      <form id="form-complete-reheating">
        <div class="alert alert-warning">
          ⚠️ VIGTIGT: Mål temperatur i CENTRUM af fødevaren
        </div>
        
        <div class="form-group">
          <label for="reheating-end-temp">Temperatur i centrum (°C) *</label>
          <input type="number" id="reheating-end-temp" class="form-control" required 
                 step="0.1" placeholder="Målt temperatur i centrum">
          <small class="form-text">Mål: Min. 75°C</small>
        </div>
        
        <div class="form-group">
          <label for="reheating-end-note">Note</label>
          <textarea id="reheating-end-note" class="form-control" rows="2" 
                    placeholder="Eventuelle bemærkninger"></textarea>
        </div>
        
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary modal-close">Annuller</button>
          <button type="submit" class="btn btn-primary">Afslut genopvarmning</button>
        </div>
      </form>
    `);
    
    const form = modal.querySelector('#form-complete-reheating');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const endTemperature = parseFloat(document.getElementById('reheating-end-temp').value);
      const note = document.getElementById('reheating-end-note').value;
      
      if (endTemperature < 75) {
        if (!confirm(`Temperatur ${endTemperature}°C er under 75°C.\n\nFortsæt alligevel? (Anbefales ikke)`)) {
          return;
        }
      }
      
      try {
        const result = await window.MKP.ProcessInstances.completeReheatingProcess({
          processId: process.id,
          endTemperature,
          note
        });
        
        closeModal(modal);
        
        if (result.canStartNewCooling) {
          // Show option to start new cooling
          showNewCoolingOptionModal(process.id, process);
        } else {
          // Failed
          await loadAndRenderActiveProcesses();
          alert('❌ Genopvarmning fejlet - temperatur ikke nået 75°C');
        }
      } catch (error) {
        console.error('Failed to complete reheating:', error);
        alert('Fejl ved afslutning af genopvarmning: ' + error.message);
      }
    });
  }

  /**
   * Show new cooling option modal
   */
  function showNewCoolingOptionModal(reheatingProcessId, processData) {
    const modal = createModal('Genopvarmning gennemført', `
      <div class="modal-success-message">
        <div class="modal-success-icon">✅</div>
        <p><strong>${escapeHtml(processData.productName)}</strong> er nu genopvarmet.</p>
        <p>Start ny nedkøling?</p>
      </div>
      
      <div class="modal-actions">
        <button type="button" class="btn btn-secondary modal-close">Afslut uden nedkøling</button>
        <button type="button" class="btn btn-primary btn-start-new-cooling">🧊 Start ny nedkøling</button>
      </div>
    `);
    
    const startBtn = modal.querySelector('.btn-start-new-cooling');
    startBtn.addEventListener('click', async () => {
      try {
        await window.MKP.ProcessInstances.startNewCoolingFromReheating({
          reheatingProcessId
        });
        
        closeModal(modal);
        await loadAndRenderActiveProcesses();
        alert('✅ Ny nedkøling startet');
      } catch (error) {
        console.error('Failed to start new cooling:', error);
        alert('Fejl ved start af ny nedkøling: ' + error.message);
      }
    });
  }

  /**
   * Create modal
   */
  function createModal(title, content) {
    const modal = document.createElement('div');
    modal.className = 'mkp-modal';
    modal.innerHTML = `
      <div class="mkp-modal-overlay"></div>
      <div class="mkp-modal-content">
        <div class="mkp-modal-header">
          <h2>${title}</h2>
          <button class="mkp-modal-close-btn modal-close">&times;</button>
        </div>
        <div class="mkp-modal-body">
          ${content}
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Close handlers
    modal.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', () => closeModal(modal));
    });
    
    modal.querySelector('.mkp-modal-overlay').addEventListener('click', () => {
      closeModal(modal);
    });
    
    return modal;
  }

  /**
   * Close modal
   */
  function closeModal(modal) {
    modal.remove();
  }

  /**
   * Escape HTML
   */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose refresh function
  window.MKP = window.MKP || {};
  window.MKP.ProcessDashboard = {
    refresh: loadAndRenderActiveProcesses
  };

})();
