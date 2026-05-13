# FILE: functions/egenkontrol/evaluators/coolingEvaluator.js

```javascript
/**
 * Cooling Control Evaluation Engine
 * Extensible time-temperature evaluation system for cooling controls
 */

/**
 * Evaluate cooling control entry
 * @param {Object} entry - Task entry with cooling data
 * @param {Object} config - Evaluation configuration from template
 * @returns {Object} Evaluation result
 */
function evaluateCoolingControl(entry, config = {}) {
    const {
        startTemp,
        endTemp,
        startTime,
        endTime,
        productCategory,
        batchSize,
        coolingMethod
    } = entry;

    const {
        maxDurationMinutes = 180,
        minStartTemp = 65,
        maxEndTemp = 10,
        evaluationMode = "cooling_time_temperature"
    } = config;

    const validation = validateCoolingData(entry);
    if (!validation.valid) {
        return {
            status: "invalid",
            passed: false,
            failureReason: validation.error,
            durationMinutes: null,
            measuredValues: { startTemp, endTemp, startTime, endTime },
            thresholdSnapshot: config,
            recommendedAction: "complete_missing_data"
        };
    }

    const durationMinutes = calculateDurationMinutes(startTime, endTime);
    const tempDrop = startTemp - endTemp;

    let passed = true;
    let failureReason = null;
    let status = "completed";
    let recommendedAction = null;

    // Evaluate based on mode
    if (evaluationMode === "cooling_time_temperature") {
        // 3-hour rule: from min 65°C to max 10°C within 180 minutes
        if (startTemp < minStartTemp) {
            passed = false;
            failureReason = `Starttemperatur ${startTemp}°C er under kravet (min ${minStartTemp}°C)`;
            recommendedAction = "reject_batch";
        } else if (endTemp > maxEndTemp) {
            passed = false;
            failureReason = `Sluttemperatur ${endTemp}°C er over kravet (max ${maxEndTemp}°C)`;
            recommendedAction = "continue_cooling";
        } else if (durationMinutes > maxDurationMinutes) {
            passed = false;
            failureReason = `Nedkøling tog ${durationMinutes} minutter (max ${maxDurationMinutes} min)`;
            recommendedAction = "evaluate_food_safety";
        }
    }

    if (!passed) {
        status = "failed";
    }

    return {
        status,
        passed,
        failureReason,
        durationMinutes,
        tempDrop,
        measuredValues: {
            startTemp,
            endTemp,
            startTime,
            endTime,
            productCategory,
            batchSize,
            coolingMethod
        },
        thresholdSnapshot: {
            maxDurationMinutes,
            minStartTemp,
            maxEndTemp,
            evaluationMode
        },
        recommendedAction,
        evaluatedAt: new Date().toISOString()
    };
}

/**
 * Validate cooling data completeness
 * @param {Object} entry - Cooling entry data
 * @returns {Object} Validation result
 */
function validateCoolingData(entry) {
    const { startTemp, endTemp, startTime, endTime } = entry;

    if (startTemp === null || startTemp === undefined) {
        return { valid: false, error: "Starttemperatur mangler" };
    }
    if (endTemp === null || endTemp === undefined) {
        return { valid: false, error: "Sluttemperatur mangler" };
    }
    if (!startTime) {
        return { valid: false, error: "Starttidspunkt mangler" };
    }
    if (!endTime) {
        return { valid: false, error: "Sluttidspunkt mangler" };
    }

    if (typeof startTemp !== "number" || typeof endTemp !== "number") {
        return { valid: false, error: "Temperaturer skal være tal" };
    }

    if (startTemp <= endTemp) {
        return { valid: false, error: "Starttemperatur skal være højere end sluttemperatur" };
    }

    return { valid: true };
}

/**
 * Calculate duration in minutes between two ISO timestamps
 * @param {string} startTime - ISO timestamp
 * @param {string} endTime - ISO timestamp
 * @returns {number} Duration in minutes
 */
function calculateDurationMinutes(startTime, endTime) {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const diffMs = end - start;
    return Math.round(diffMs / 60000);
}

/**
 * Format evaluation result for display
 * @param {Object} evaluation - Evaluation result
 * @returns {string} Human-readable summary
 */
function formatEvaluationSummary(evaluation) {
    if (!evaluation.passed) {
        return `❌ Ikke godkendt: ${evaluation.failureReason}`;
    }

    const { durationMinutes, tempDrop, measuredValues } = evaluation;
    return `✅ Godkendt: ${measuredValues.startTemp}°C → ${measuredValues.endTemp}°C på ${durationMinutes} min (${tempDrop}°C fald)`;
}

module.exports = {
    evaluateCoolingControl,
    validateCoolingData,
    calculateDurationMinutes,
    formatEvaluationSummary
};

```
