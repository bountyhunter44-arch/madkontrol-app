/**
 * Core Policy Router
 * Routes context to appropriate policy boxes
 */

/**
 * Resolve which policy boxes apply to a given context
 * @param {Object} context - Context information
 * @param {Object} context.domain - Domain identifier (e.g., 'food_safety', 'gdpr', 'financial')
 * @param {string} context.ruleFamily - Rule family (e.g., 'temperature_control', 'consent_management')
 * @param {Array} context.tags - Optional tags for fine-grained matching
 * @param {Object} registry - Policy registry
 * @returns {Array} Array of applicable policy boxes
 */
function resolvePolicyBoxes(context, registry) {
    if (!context || !registry) {
        return [];
    }

    const { domain, ruleFamily, tags = [] } = context;
    const applicableBoxes = [];

    // Get all policy boxes from registry
    const allBoxes = Object.values(registry).flat();

    for (const box of allBoxes) {
        let matches = true;

        // Match domain
        if (domain && box.domain && box.domain !== domain) {
            matches = false;
        }

        // Match rule family
        if (ruleFamily && box.ruleFamily && box.ruleFamily !== ruleFamily) {
            matches = false;
        }

        // Match tags (box must have at least one matching tag if tags are specified)
        if (tags.length > 0 && box.tags) {
            const hasMatchingTag = tags.some(tag => box.tags.includes(tag));
            if (!hasMatchingTag) {
                matches = false;
            }
        }

        if (matches) {
            applicableBoxes.push(box);
        }
    }

    return applicableBoxes;
}

/**
 * Get policy boxes by domain
 * @param {string} domain - Domain identifier
 * @param {Object} registry - Policy registry
 * @returns {Array} Array of policy boxes for the domain
 */
function getPolicyBoxesByDomain(domain, registry) {
    if (!domain || !registry || !registry[domain]) {
        return [];
    }
    return registry[domain] || [];
}

/**
 * Get a specific policy box by ID
 * @param {string} boxId - Policy box ID
 * @param {Object} registry - Policy registry
 * @returns {Object|null} Policy box or null if not found
 */
function getPolicyBoxById(boxId, registry) {
    const allBoxes = Object.values(registry).flat();
    return allBoxes.find(box => box.id === boxId) || null;
}

export {
    resolvePolicyBoxes,
    getPolicyBoxesByDomain,
    getPolicyBoxById
};
