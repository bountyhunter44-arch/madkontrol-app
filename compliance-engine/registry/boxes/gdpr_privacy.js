/**
 * GDPR and Privacy Policy Boxes
 * Data protection and consent compliance rules
 */

const gdprPrivacyBoxes = [
    {
        id: 'contact_legal_basis',
        name: 'Kontakt Lovligt Grundlag',
        domain: 'gdpr',
        ruleFamily: 'consent_management',
        tags: ['contact', 'legal_basis', 'gdpr'],
        rules: [
            {
                id: 'no_contact_without_legal_basis',
                message: 'Kontakt kræver lovligt grundlag (samtykke, kontrakt, eller legitim interesse)',
                severity: 'critical',
                evaluate: (input) => {
                    const hasConsent = input.hasConsent || input.consent === true;
                    const hasContract = input.hasContract || input.contractBasis === true;
                    const hasLegitimateInterest = input.hasLegitimateInterest || input.legitimateInterest === true;
                    const contactType = input.contactType || input.type;
                    
                    const hasLegalBasis = hasConsent || hasContract || hasLegitimateInterest;
                    
                    if (!hasLegalBasis) {
                        return {
                            passed: false,
                            message: `Intet lovligt grundlag for ${contactType || 'kontakt'}`,
                            value: { hasConsent, hasContract, hasLegitimateInterest },
                            threshold: 'legal_basis_required'
                        };
                    }
                    
                    return {
                        passed: true,
                        message: 'Lovligt grundlag verificeret',
                        value: { hasConsent, hasContract, hasLegitimateInterest }
                    };
                }
            }
        ]
    },

    {
        id: 'marketing_consent',
        name: 'Marketing Samtykke',
        domain: 'gdpr',
        ruleFamily: 'consent_management',
        tags: ['marketing', 'consent', 'gdpr'],
        rules: [
            {
                id: 'consent_required_for_marketing',
                message: 'Eksplicit samtykke kræves for marketing',
                severity: 'critical',
                evaluate: (input) => {
                    const isMarketing = input.isMarketing || input.purpose === 'marketing';
                    const hasMarketingConsent = input.hasMarketingConsent || input.marketingConsent === true;
                    
                    // If not marketing, rule doesn't apply
                    if (!isMarketing) {
                        return {
                            passed: true,
                            message: 'Ikke marketing - regel ikke relevant'
                        };
                    }
                    
                    if (!hasMarketingConsent) {
                        return {
                            passed: false,
                            message: 'Marketing kræver eksplicit samtykke',
                            value: hasMarketingConsent,
                            threshold: true
                        };
                    }
                    
                    return {
                        passed: true,
                        message: 'Marketing samtykke verificeret',
                        value: hasMarketingConsent
                    };
                }
            },
            {
                id: 'consent_timestamp_required',
                message: 'Samtykke skal have tidsstempel',
                severity: 'high',
                evaluate: (input) => {
                    const hasMarketingConsent = input.hasMarketingConsent || input.marketingConsent === true;
                    const consentTimestamp = input.consentTimestamp || input.consentDate;
                    
                    // Only check if consent is given
                    if (!hasMarketingConsent) {
                        return {
                            passed: true,
                            message: 'Intet samtykke - tidsstempel ikke relevant'
                        };
                    }
                    
                    if (!consentTimestamp) {
                        return {
                            passed: false,
                            message: 'Samtykke mangler tidsstempel',
                            value: consentTimestamp,
                            threshold: 'timestamp_required'
                        };
                    }
                    
                    return {
                        passed: true,
                        message: 'Samtykke tidsstempel OK',
                        value: consentTimestamp
                    };
                }
            }
        ]
    },

    {
        id: 'data_retention',
        name: 'Data Opbevaring',
        domain: 'gdpr',
        ruleFamily: 'data_management',
        tags: ['retention', 'storage', 'gdpr'],
        rules: [
            {
                id: 'retention_period_not_exceeded',
                message: 'Data må ikke opbevares længere end nødvendigt',
                severity: 'high',
                evaluate: (input) => {
                    const createdAt = input.createdAt || input.timestamp;
                    const retentionDays = input.retentionDays || 365; // Default 1 year
                    
                    if (!createdAt) {
                        return {
                            passed: false,
                            message: 'Oprettelsesdato mangler',
                            value: null,
                            threshold: retentionDays
                        };
                    }
                    
                    const createdDate = new Date(createdAt);
                    const now = new Date();
                    const daysSinceCreation = Math.floor((now - createdDate) / (1000 * 60 * 60 * 24));
                    
                    const passed = daysSinceCreation <= retentionDays;
                    
                    return {
                        passed,
                        message: passed 
                            ? `Opbevaring OK: ${daysSinceCreation} dage (max: ${retentionDays})` 
                            : `Opbevaring overskredet: ${daysSinceCreation} dage (max: ${retentionDays})`,
                        value: daysSinceCreation,
                        threshold: retentionDays
                    };
                }
            }
        ]
    },

    {
        id: 'data_minimization',
        name: 'Data Minimering',
        domain: 'gdpr',
        ruleFamily: 'data_management',
        tags: ['minimization', 'privacy', 'gdpr'],
        rules: [
            {
                id: 'no_excessive_data_collection',
                message: 'Kun nødvendige data må indsamles',
                severity: 'medium',
                evaluate: (input) => {
                    const collectedFields = input.collectedFields || [];
                    const requiredFields = input.requiredFields || [];
                    const purpose = input.purpose || 'unknown';
                    
                    if (collectedFields.length === 0) {
                        return {
                            passed: true,
                            message: 'Ingen data indsamlet'
                        };
                    }
                    
                    // Check if all collected fields are required
                    const excessiveFields = collectedFields.filter(
                        field => !requiredFields.includes(field)
                    );
                    
                    const passed = excessiveFields.length === 0;
                    
                    return {
                        passed,
                        message: passed 
                            ? 'Data minimering OK' 
                            : `Unødvendige felter indsamlet: ${excessiveFields.join(', ')}`,
                        value: { collected: collectedFields.length, required: requiredFields.length },
                        threshold: { excessive: excessiveFields }
                    };
                }
            }
        ]
    }
];

export default gdprPrivacyBoxes;
