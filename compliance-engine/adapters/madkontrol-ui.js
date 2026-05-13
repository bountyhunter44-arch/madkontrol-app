/**
 * Madkontrol UI Adapter
 * Maps Madkontrol task data to compliance engine input
 */

import { evaluate } from '../core/evaluator.js';
import { resolvePolicyBoxes } from '../core/router.js';
import { createComplianceReport } from '../core/signal-factory.js';
import { policyRegistry } from '../registry/index.js';

/**
 * Map Madkontrol task to compliance input
 * @param {Object} task - Task instance
 * @param {Object} entryData - Entry data from task
 * @returns {Object} Normalized compliance input
 */
function mapTaskToComplianceInput(task, entryData) {
    const input = {
        taskId: task.id,
        routineType: task.routineType || task.controlType,
        timestamp: new Date().toISOString()
    };

    // Map temperature data
    if (entryData.measurementValue !== null && entryData.measurementValue !== undefined) {
        input.temperature = entryData.measurementValue;
        input.measuredTemperature = entryData.measurementValue;
    }

    // Map reheating specific data
    if (task.controlType === 'reheating_control' || task.routineType === 'opvarmning') {
        const latestRun = task.heatingRuns && task.heatingRuns.length > 0 
            ? task.heatingRuns[task.heatingRuns.length - 1] 
            : null;
        
        if (latestRun) {
            input.finalTemperature = latestRun.finalTemperature;
            input.temperature = latestRun.finalTemperature;
            input.productName = latestRun.productName;
        }
    }

    // Map hot holding data
    if (task.controlType === 'hot_holding_control' || task.routineType === 'varmholdelse') {
        const latestRun = task.hotHoldingRuns && task.hotHoldingRuns.length > 0 
            ? task.hotHoldingRuns[task.hotHoldingRuns.length - 1] 
            : null;
        
        if (latestRun) {
            input.temperature = latestRun.temperature;
            input.measuredTemperature = latestRun.temperature;
        }
    }

    // Map cooling data
    if (task.routineType === 'nedkoeling' || entryData.entryType === 'cooling_control') {
        if (entryData.coolingRuns && entryData.coolingRuns.length > 0) {
            const run = entryData.coolingRuns[0];
            input.startTemperature = run.startTemp;
            input.startTemp = run.startTemp;
            input.endTemperature = run.endTemp;
            input.endTemp = run.endTemp;
            input.durationMinutes = run.durationMinutes;
        }
    }

    // Map goods receiving data
    if (task.routineType === 'varemodtagelse' || task.controlType === 'receiving_control') {
        input.productType = task.productType || entryData.productType;
        if (entryData.measurementValue !== null && entryData.measurementValue !== undefined) {
            input.temperature = entryData.measurementValue;
        }
    }

    return input;
}

/**
 * Determine compliance context from task
 * @param {Object} task - Task instance
 * @returns {Object} Compliance context
 */
function getComplianceContext(task) {
    const routineType = task.routineType || task.controlType;
    
    // Map routine types to compliance domains
    const domainMap = {
        'opvarmning': { domain: 'food_safety', ruleFamily: 'temperature_control', tags: ['reheating'] },
        'reheating_control': { domain: 'food_safety', ruleFamily: 'temperature_control', tags: ['reheating'] },
        'varmholdelse': { domain: 'food_safety', ruleFamily: 'temperature_control', tags: ['hot_holding'] },
        'hot_holding_control': { domain: 'food_safety', ruleFamily: 'temperature_control', tags: ['hot_holding'] },
        'nedkoeling': { domain: 'food_safety', ruleFamily: 'temperature_control', tags: ['cooling'] },
        'cooling_control': { domain: 'food_safety', ruleFamily: 'temperature_control', tags: ['cooling'] },
        'varemodtagelse': { domain: 'food_safety', ruleFamily: 'temperature_control', tags: ['receiving'] },
        'receiving_control': { domain: 'food_safety', ruleFamily: 'temperature_control', tags: ['receiving'] }
    };

    return domainMap[routineType] || { domain: 'food_safety', tags: [] };
}

/**
 * Evaluate a Madkontrol task against compliance policies
 * @param {Object} task - Task instance
 * @param {Object} entryData - Entry data from task
 * @param {Object} options - Optional AI scores
 * @returns {Object} Compliance report
 */
function evaluateMadkontrolTask(task, entryData, options = {}) {
    // Map task to compliance input
    const input = mapTaskToComplianceInput(task, entryData);
    
    // Get compliance context
    const context = getComplianceContext(task);
    
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
        taskId: task.id,
        routineType: task.routineType || task.controlType
    };
}

/**
 * Check if task should create deviation based on compliance
 * @param {Object} task - Task instance
 * @param {Object} entryData - Entry data from task
 * @returns {Object} Deviation decision
 */
function shouldCreateDeviation(task, entryData) {
    const report = evaluateMadkontrolTask(task, entryData);
    
    return {
        shouldCreate: report.gate === 'hard_block' || report.gate === 'manual_review',
        severity: report.gate === 'hard_block' ? 'critical' : 'high',
        message: report.message,
        details: report.details,
        report
    };
}

export {
    mapTaskToComplianceInput,
    getComplianceContext,
    evaluateMadkontrolTask,
    shouldCreateDeviation
};
