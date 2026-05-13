/**
 * Signal Factory
 * Creates user-facing messages for compliance decisions
 */

/**
 * Create a signal message based on decision gate
 * @param {Object} decision - Decision object from evaluator
 * @returns {Object} Signal message
 */
function createSignalMessage(decision) {
    if (!decision || !decision.gate) {
        return {
            gate: 'unknown',
            message: 'Kunne ikke evaluere.',
            severity: 'error',
            action: 'review'
        };
    }

    const { gate, policyBoxes = [], hasCriticalViolations } = decision;

    let message = '';
    let severity = 'info';
    let details = [];

    switch (gate) {
        case 'hard_block':
            message = 'Stop. Regelmatch er for lavt. Tjek manuelt.';
            severity = 'critical';
            
            // Extract critical violations
            if (policyBoxes.length > 0) {
                policyBoxes.forEach(box => {
                    if (box.violations && box.violations.length > 0) {
                        box.violations.forEach(v => {
                            if (v.severity === 'critical' || v.severity === 'high') {
                                details.push({
                                    box: box.boxName || box.boxId,
                                    rule: v.ruleId,
                                    message: v.message,
                                    severity: v.severity
                                });
                            }
                        });
                    }
                });
            }
            break;

        case 'manual_review':
            message = 'Manuel vurdering kræves.';
            severity = 'warning';
            
            // Extract all violations
            if (policyBoxes.length > 0) {
                policyBoxes.forEach(box => {
                    if (box.violations && box.violations.length > 0) {
                        box.violations.forEach(v => {
                            details.push({
                                box: box.boxName || box.boxId,
                                rule: v.ruleId,
                                message: v.message,
                                severity: v.severity
                            });
                        });
                    }
                });
            }
            break;

        case 'warning':
            message = 'Advarsel. Tjek kildegrundlag.';
            severity = 'warning';
            
            // Extract warnings
            if (policyBoxes.length > 0) {
                policyBoxes.forEach(box => {
                    if (box.warnings && box.warnings.length > 0) {
                        box.warnings.forEach(w => {
                            details.push({
                                box: box.boxName || box.boxId,
                                rule: w.ruleId,
                                message: w.message,
                                severity: w.severity
                            });
                        });
                    }
                    if (box.violations && box.violations.length > 0) {
                        box.violations.forEach(v => {
                            details.push({
                                box: box.boxName || box.boxId,
                                rule: v.ruleId,
                                message: v.message,
                                severity: v.severity
                            });
                        });
                    }
                });
            }
            break;

        case 'ok':
            message = '';
            severity = 'success';
            break;

        default:
            message = 'Ukendt status.';
            severity = 'info';
    }

    return {
        gate,
        message,
        severity,
        details,
        action: decision.action,
        timestamp: decision.timestamp || new Date().toISOString()
    };
}

/**
 * Create a detailed compliance report
 * @param {Object} decision - Decision object from evaluator
 * @returns {Object} Detailed report
 */
function createComplianceReport(decision) {
    const signal = createSignalMessage(decision);
    
    return {
        ...signal,
        score: {
            final: decision.finalScore,
            policy: decision.policyMatch,
            embedding: decision.embeddingScore,
            confidence: decision.logprobConfidence
        },
        boxes: decision.policyBoxes || [],
        hasCriticalViolations: decision.hasCriticalViolations || false,
        hasViolations: decision.hasViolations || false
    };
}

export {
    createSignalMessage,
    createComplianceReport
};
