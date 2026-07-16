/**
 * Build Procedurer - Generates procedure definitions from country config
 * Returns language-neutral procedure objects
 */

export function buildProcedurer(countryConfig, branchConfig) {
    const procedurer = {};
    const procedureTemplates = countryConfig.procedureTemplates || {};
    
    // Build each procedure from country template
    Object.keys(procedureTemplates).forEach(procedureKey => {
        const template = procedureTemplates[procedureKey];
        
        const procedure = {
            key: template.key,
            titleKey: template.titleKey,
            descriptionKey: template.descriptionKey,
            type: template.type,
            isGAG: template.isGAG || false,
            criticalPoints: [...(template.criticalPoints || [])],
            enabled: true
        };
        
        procedurer[procedureKey] = procedure;
    });
    
    return procedurer;
}

export function getEnabledProcedurer(procedurer) {
    return Object.entries(procedurer)
        .filter(([_, procedure]) => procedure.enabled === true)
        .reduce((acc, [key, procedure]) => {
            acc[key] = procedure;
            return acc;
        }, {});
}
