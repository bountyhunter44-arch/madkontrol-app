/**
 * Compliance Engine
 * Main entry point
 */

// Core modules
import * as evaluator from './core/evaluator.js';
import * as router from './core/router.js';
import * as signalFactory from './core/signal-factory.js';

// Registry
import * as registry from './registry/index.js';

// Adapters
import * as madkontrolAdapter from './adapters/madkontrol-ui.js';
import * as crmAdapter from './adapters/crm-connector.js';

export {
  // Core
  evaluator,
  router,
  signalFactory,
  
  // Registry
  registry,
  
  // Adapters
  madkontrolAdapter as madkontrol,
  crmAdapter as crm
};

// Re-export commonly used functions
export { evaluate, evaluatePolicyBox, scoreDecision } from './core/evaluator.js';
export { resolvePolicyBoxes, getPolicyBoxesByDomain, getPolicyBoxById } from './core/router.js';
export { createSignalMessage, createComplianceReport } from './core/signal-factory.js';
export { policyRegistry, getAllPolicyBoxes } from './registry/index.js';
