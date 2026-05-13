/**
 * Build Skemaer - Generates schema definitions from country/branch config
 * Returns language-neutral schema objects
 */

import { shouldEnableSchema } from './buildPersonalisering.js';

export function buildSkemaer(countryConfig, branchConfig, personalisering, units) {
    const skemaer = {};
    const activities = personalisering.aktiviteter || {};
    const schemaTemplates = countryConfig.schemaTemplates || {};
    const branchOverrides = branchConfig?.schemaOverrides || {};
    
    // Build each schema from country template
    Object.keys(schemaTemplates).forEach(schemaKey => {
        const template = schemaTemplates[schemaKey];
        const override = branchOverrides[schemaKey] || {};
        const enabled = shouldEnableSchema(schemaKey, activities);
        
        const schema = {
            key: template.key,
            titleKey: template.titleKey,
            descriptionKey: template.descriptionKey,
            type: template.type,
            enabled: enabled,
            isCCP: template.isCCP || false,
            isGAG: template.isGAG || false,
            ccpNumber: template.ccpNumber || null,
            criticalLimits: { ...template.criticalLimits },
            frequencyKey: template.frequencyKey,
            controlPointKey: template.controlPointKey,
            actionKey: template.actionKey
        };
        
        // Add units if required
        if (template.requiresUnits && template.unitTypes) {
            schema.units = units.filter(u => template.unitTypes.includes(u.type));
        }
        
        // Add branch-specific notes
        if (override.additionalNoteKey) {
            schema.additionalNoteKey = override.additionalNoteKey;
        }
        
        // Store with legacy naming for compatibility
        const legacyKey = `skema${template.ccpNumber || 5}_${schemaKey}`;
        skemaer[legacyKey] = schema;
    });
    
    return skemaer;
}

export function getEnabledSkemaer(skemaer) {
    return Object.entries(skemaer)
        .filter(([_, schema]) => schema.enabled === true)
        .reduce((acc, [key, schema]) => {
            acc[key] = schema;
            return acc;
        }, {});
}

export function getSkemaByType(skemaer, type) {
    return Object.values(skemaer).find(s => s.type === type);
}

export function getCCPSkemaer(skemaer) {
    return Object.entries(skemaer)
        .filter(([_, schema]) => schema.isCCP === true)
        .reduce((acc, [key, schema]) => {
            acc[key] = schema;
            return acc;
        }, {});
}

export function getGAGSkemaer(skemaer) {
    return Object.entries(skemaer)
        .filter(([_, schema]) => schema.isGAG === true)
        .reduce((acc, [key, schema]) => {
            acc[key] = schema;
            return acc;
        }, {});
}
