/**
 * Core Compliance Evaluator
 * Domain-agnostic policy evaluation engine
 */

/**
 * Evaluate a single policy box against input data
 * @param {Object} input - Normalized input data
 * @param {Object} policyBox - Policy box definition
 * @returns {Object} Evaluation result
 */
function evaluatePolicyBox(input, policyBox) {
    if (!policyBox || !policyBox.rules) {
        return {
            boxId: policyBox?.id || 'unknown',
            passed: true,
            score: 1.0,
            violations: [],
            warnings: []
        };
    }

    const violations = [];
    const warnings = [];
    let totalRules = 0;
    let passedRules = 0;

    for (const rule of policyBox.rules) {
        totalRules++;
        
        try {
            const result = rule.evaluate(input);
            
            if (result.passed) {
                passedRules++;
            } else {
                if (rule.severity === 'critical' || rule.severity === 'high') {
                    violations.push({
                        ruleId: rule.id,
                        message: result.message || rule.message,
                        severity: rule.severity,
                        value: result.value,
                        threshold: result.threshold
                    });
                } else {
                    warnings.push({
                        ruleId: rule.id,
                        message: result.message || rule.message,
                        severity: rule.severity,
                        value: result.value,
                        threshold: result.threshold
                    });
                }
            }
        } catch (error) {
            violations.push({
                ruleId: rule.id,
                message: `Rule evaluation error: ${error.message}`,
                severity: 'critical',
                error: true
            });
        }
    }

    const score = totalRules > 0 ? passedRules / totalRules : 1.0;
    const passed = violations.length === 0;

    return {
        boxId: policyBox.id,
        boxName: policyBox.name,
        passed,
        score,
        violations,
        warnings,
        totalRules,
        passedRules
    };
}

/**
 * Score a decision using multiple signals
 * @param {Object} params - Scoring parameters
 * @param {Object} params.input - Input data
 * @param {Array} params.policyBoxes - Array of policy box evaluation results
 * @param {Object} params.scores - Optional AI/embedding scores
 * @returns {Object} Final decision with score and gate
 */
function scoreDecision({ input, policyBoxes, scores = {} }) {
    // Extract scores with defaults
    const embeddingScore = scores.embedding_score || 0.5;
    const logprobConfidence = scores.logprob_confidence || 0.5;
    
    // Calculate policy match score
    let policyMatch = 1.0;
    let hasViolations = false;
    let hasCriticalViolations = false;
    
    if (policyBoxes && policyBoxes.length > 0) {
        const totalScore = policyBoxes.reduce((sum, box) => sum + (box.score || 0), 0);
        policyMatch = totalScore / policyBoxes.length;
        
        hasViolations = policyBoxes.some(box => box.violations && box.violations.length > 0);
        hasCriticalViolations = policyBoxes.some(box => 
            box.violations && box.violations.some(v => v.severity === 'critical')
        );
    }
    
    // Calculate final score with weights
    const finalScore = 
        0.40 * embeddingScore +
        0.20 * logprobConfidence +
        0.40 * policyMatch;
    
    // Determine gate based on policy match
    let gate;
    let action;
    
    if (hasCriticalViolations || policyMatch < 0.15) {
        gate = 'hard_block';
        action = 'reject';
    } else if (policyMatch < 0.45) {
        gate = 'manual_review';
        action = 'review';
    } else if (policyMatch < 0.75 || hasViolations) {
        gate = 'warning';
        action = 'warn';
    } else {
        gate = 'ok';
        action = 'approve';
    }
    
    return {
        finalScore,
        policyMatch,
        embeddingScore,
        logprobConfidence,
        gate,
        action,
        hasViolations,
        hasCriticalViolations,
        policyBoxes,
        timestamp: new Date().toISOString()
    };
}

/**
 * Evaluate multiple policy boxes and return aggregated decision
 * @param {Object} input - Normalized input data
 * @param {Array} policyBoxes - Array of policy box definitions
 * @param {Object} scores - Optional AI/embedding scores
 * @returns {Object} Complete evaluation decision
 */
function evaluate(input, policyBoxes, scores = {}) {
    const evaluatedBoxes = policyBoxes.map(box => evaluatePolicyBox(input, box));
    return scoreDecision({ input, policyBoxes: evaluatedBoxes, scores });
}

export {
    evaluatePolicyBox,
    scoreDecision,
    evaluate
};
