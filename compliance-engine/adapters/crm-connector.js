/**
 * CRM Connector Adapter
 * Maps CRM prospect/contact data to compliance engine input
 */

import { evaluate } from '../core/evaluator.js';
import { resolvePolicyBoxes } from '../core/router.js';
import { createComplianceReport } from '../core/signal-factory.js';
import { policyRegistry } from '../registry/index.js';

/**
 * Map CRM prospect to compliance input
 * @param {Object} prospect - Prospect/contact data
 * @returns {Object} Normalized compliance input
 */
function mapProspectToComplianceInput(prospect) {
    const input = {
        prospectId: prospect.id,
        timestamp: new Date().toISOString()
    };

    // Map consent data
    input.hasConsent = prospect.hasConsent || prospect.consent === true;
    input.hasMarketingConsent = prospect.hasMarketingConsent || prospect.marketingConsent === true;
    input.consentTimestamp = prospect.consentTimestamp || prospect.consentDate;
    
    // Map legal basis
    input.hasContract = prospect.hasContract || prospect.contractBasis === true;
    input.hasLegitimateInterest = prospect.hasLegitimateInterest || prospect.legitimateInterest === true;
    
    // Map contact type
    input.contactType = prospect.contactType || prospect.type || 'unknown';
    input.isMarketing = prospect.isMarketing || prospect.purpose === 'marketing';
    input.purpose = prospect.purpose || 'contact';
    
    // Map data retention
    input.createdAt = prospect.createdAt || prospect.timestamp;
    input.retentionDays = prospect.retentionDays || 365;
    
    // Map data minimization
    input.collectedFields = prospect.collectedFields || [];
    input.requiredFields = prospect.requiredFields || [];

    return input;
}

/**
 * Determine compliance context for CRM operation
 * @param {Object} prospect - Prospect/contact data
 * @param {string} operation - Operation type (contact, marketing, data_export, etc.)
 * @returns {Object} Compliance context
 */
function getComplianceContext(prospect, operation = 'contact') {
    const isMarketing = prospect.isMarketing || prospect.purpose === 'marketing';
    
    if (isMarketing || operation === 'marketing') {
        return {
            domain: 'gdpr',
            ruleFamily: 'consent_management',
            tags: ['marketing', 'consent']
        };
    }
    
    if (operation === 'data_export' || operation === 'data_retention') {
        return {
            domain: 'gdpr',
            ruleFamily: 'data_management',
            tags: ['retention', 'storage']
        };
    }
    
    // Default: contact with legal basis check
    return {
        domain: 'gdpr',
        ruleFamily: 'consent_management',
        tags: ['contact', 'legal_basis']
    };
}

/**
 * Evaluate a CRM prospect against GDPR compliance policies
 * @param {Object} prospect - Prospect/contact data
 * @param {string} operation - Operation type
 * @param {Object} options - Optional AI scores
 * @returns {Object} Compliance report
 */
function evaluateCrmProspect(prospect, operation = 'contact', options = {}) {
    // Map prospect to compliance input
    const input = mapProspectToComplianceInput(prospect);
    
    // Get compliance context
    const context = getComplianceContext(prospect, operation);
    
    // Resolve applicable policy boxes
    const policyBoxes = resolvePolicyBoxes(context, policyRegistry);
    
    // Evaluate
    const decision = evaluate(input, policyBoxes, options.scores || {});
    
    // Create report
    const report = createComplianceReport(decision);
    
    return {
        ...report,
        input,
        context,
        prospectId: prospect.id,
        operation
    };
}

/**
 * Check if contact is allowed based on GDPR compliance
 * @param {Object} prospect - Prospect/contact data
 * @param {string} contactType - Type of contact (email, phone, marketing, etc.)
 * @returns {Object} Contact permission decision
 */
function canContact(prospect, contactType = 'email') {
    const operation = contactType === 'marketing' ? 'marketing' : 'contact';
    const report = evaluateCrmProspect(prospect, operation);
    
    return {
        allowed: report.gate === 'ok' || report.gate === 'warning',
        requiresReview: report.gate === 'manual_review',
        blocked: report.gate === 'hard_block',
        message: report.message,
        details: report.details,
        report
    };
}

/**
 * Validate data collection against GDPR minimization
 * @param {Object} dataCollection - Data collection details
 * @returns {Object} Validation result
 */
function validateDataCollection(dataCollection) {
    const input = {
        collectedFields: dataCollection.collectedFields || [],
        requiredFields: dataCollection.requiredFields || [],
        purpose: dataCollection.purpose || 'unknown'
    };
    
    const context = {
        domain: 'gdpr',
        ruleFamily: 'data_management',
        tags: ['minimization', 'privacy']
    };
    
    const policyBoxes = resolvePolicyBoxes(context, policyRegistry);
    const decision = evaluate(input, policyBoxes);
    const report = createComplianceReport(decision);
    
    return {
        valid: report.gate === 'ok',
        warnings: report.details,
        report
    };
}

export {
    mapProspectToComplianceInput,
    getComplianceContext,
    evaluateCrmProspect,
    canContact,
    validateDataCollection
};
