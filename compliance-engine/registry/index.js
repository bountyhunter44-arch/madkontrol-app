/**
 * Policy Registry
 * Central registry of all policy boxes
 */

import foodSafetyBoxes from './boxes/food_safety.js';
import gdprPrivacyBoxes from './boxes/gdpr_privacy.js';
import financialLimitsBoxes from './boxes/financial_limits.js';

/**
 * Policy Registry
 * Organized by domain
 */
const policyRegistry = {
    food_safety: foodSafetyBoxes,
    gdpr: gdprPrivacyBoxes,
    financial: financialLimitsBoxes
};

/**
 * Get all policy boxes as flat array
 * @returns {Array} All policy boxes
 */
function getAllPolicyBoxes() {
    return Object.values(policyRegistry).flat();
}

/**
 * Get policy boxes by domain
 * @param {string} domain - Domain identifier
 * @returns {Array} Policy boxes for domain
 */
function getPolicyBoxesByDomain(domain) {
    return policyRegistry[domain] || [];
}

/**
 * Get a specific policy box by ID
 * @param {string} boxId - Policy box ID
 * @returns {Object|null} Policy box or null
 */
function getPolicyBoxById(boxId) {
    const allBoxes = getAllPolicyBoxes();
    return allBoxes.find(box => box.id === boxId) || null;
}

export {
    policyRegistry,
    getAllPolicyBoxes,
    getPolicyBoxesByDomain,
    getPolicyBoxById
};
