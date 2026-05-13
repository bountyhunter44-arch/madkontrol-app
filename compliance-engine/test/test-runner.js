/**
 * Simple Test Runner for Compliance Engine
 */

import { evaluateMadkontrolTask } from '../adapters/madkontrol-ui.js';
import { evaluateCrmProspect, canContact } from '../adapters/crm-connector.js';

console.log('=== COMPLIANCE ENGINE TEST SUITE ===\n');

// Test 1: Reheating - Temperature too low (should fail)
console.log('TEST 1: Opvarmning 56°C (should fail)');
const test1Task = {
    id: 'test_1',
    routineType: 'opvarmning',
    controlType: 'reheating_control',
    heatingRuns: [
        {
            productName: 'Lasagne',
            finalTemperature: 56
        }
    ]
};
const test1Entry = {
    measurementValue: 56
};
const test1Result = evaluateMadkontrolTask(test1Task, test1Entry);
console.log('Gate:', test1Result.gate);
console.log('Message:', test1Result.message);
console.log('Expected: hard_block or manual_review');
console.log('Pass:', test1Result.gate === 'hard_block' || test1Result.gate === 'manual_review' ? '✓' : '✗');
console.log('Details:', JSON.stringify(test1Result.details, null, 2));
console.log('---\n');

// Test 2: Reheating - Temperature OK (should pass)
console.log('TEST 2: Opvarmning 78°C (should pass)');
const test2Task = {
    id: 'test_2',
    routineType: 'opvarmning',
    controlType: 'reheating_control',
    heatingRuns: [
        {
            productName: 'Lasagne',
            finalTemperature: 78
        }
    ]
};
const test2Entry = {
    measurementValue: 78
};
const test2Result = evaluateMadkontrolTask(test2Task, test2Entry);
console.log('Gate:', test2Result.gate);
console.log('Message:', test2Result.message);
console.log('Expected: ok');
console.log('Pass:', test2Result.gate === 'ok' ? '✓' : '✗');
console.log('---\n');

// Test 3: Hot holding - Temperature too low (should fail)
console.log('TEST 3: Varmholdelse 56°C (should fail)');
const test3Task = {
    id: 'test_3',
    routineType: 'varmholdelse',
    controlType: 'hot_holding_control',
    hotHoldingRuns: [
        {
            temperature: 56
        }
    ]
};
const test3Entry = {
    measurementValue: 56
};
const test3Result = evaluateMadkontrolTask(test3Task, test3Entry);
console.log('Gate:', test3Result.gate);
console.log('Message:', test3Result.message);
console.log('Expected: hard_block or manual_review');
console.log('Pass:', test3Result.gate === 'hard_block' || test3Result.gate === 'manual_review' ? '✓' : '✗');
console.log('Details:', JSON.stringify(test3Result.details, null, 2));
console.log('---\n');

// Test 4: Hot holding - Temperature OK (should pass)
console.log('TEST 4: Varmholdelse 68°C (should pass)');
const test4Task = {
    id: 'test_4',
    routineType: 'varmholdelse',
    controlType: 'hot_holding_control',
    hotHoldingRuns: [
        {
            temperature: 68
        }
    ]
};
const test4Entry = {
    measurementValue: 68
};
const test4Result = evaluateMadkontrolTask(test4Task, test4Entry);
console.log('Gate:', test4Result.gate);
console.log('Message:', test4Result.message);
console.log('Expected: ok');
console.log('Pass:', test4Result.gate === 'ok' ? '✓' : '✗');
console.log('---\n');

// Test 5: Cooling - Within time limit (should pass)
console.log('TEST 5: Nedkøling 65°C → 8°C på 180 min (should pass)');
const test5Task = {
    id: 'test_5',
    routineType: 'nedkoeling'
};
const test5Entry = {
    entryType: 'cooling_control',
    coolingRuns: [
        {
            startTemp: 65,
            endTemp: 8,
            durationMinutes: 180
        }
    ]
};
const test5Result = evaluateMadkontrolTask(test5Task, test5Entry);
console.log('Gate:', test5Result.gate);
console.log('Message:', test5Result.message);
console.log('Expected: ok');
console.log('Pass:', test5Result.gate === 'ok' ? '✓' : '✗');
console.log('---\n');

// Test 6: Cooling - Too slow (should fail)
console.log('TEST 6: Nedkøling 65°C → 12°C på 300 min (should fail)');
const test6Task = {
    id: 'test_6',
    routineType: 'nedkoeling'
};
const test6Entry = {
    entryType: 'cooling_control',
    coolingRuns: [
        {
            startTemp: 65,
            endTemp: 12,
            durationMinutes: 300
        }
    ]
};
const test6Result = evaluateMadkontrolTask(test6Task, test6Entry);
console.log('Gate:', test6Result.gate);
console.log('Message:', test6Result.message);
console.log('Expected: hard_block or manual_review');
console.log('Pass:', test6Result.gate === 'hard_block' || test6Result.gate === 'manual_review' ? '✓' : '✗');
console.log('Details:', JSON.stringify(test6Result.details, null, 2));
console.log('---\n');

// Test 7: CRM - Marketing without consent (should fail)
console.log('TEST 7: CRM Marketing uden samtykke (should fail)');
const test7Prospect = {
    id: 'prospect_1',
    isMarketing: true,
    hasMarketingConsent: false,
    purpose: 'marketing'
};
const test7Result = canContact(test7Prospect, 'marketing');
console.log('Allowed:', test7Result.allowed);
console.log('Blocked:', test7Result.blocked);
console.log('Message:', test7Result.message);
console.log('Expected: blocked = true');
console.log('Pass:', test7Result.blocked === true ? '✓' : '✗');
console.log('Details:', JSON.stringify(test7Result.details, null, 2));
console.log('---\n');

// Test 8: CRM - Marketing with consent (should pass)
console.log('TEST 8: CRM Marketing med samtykke (should pass)');
const test8Prospect = {
    id: 'prospect_2',
    isMarketing: true,
    hasMarketingConsent: true,
    consentTimestamp: new Date().toISOString(),
    purpose: 'marketing'
};
const test8Result = canContact(test8Prospect, 'marketing');
console.log('Allowed:', test8Result.allowed);
console.log('Blocked:', test8Result.blocked);
console.log('Message:', test8Result.message);
console.log('Expected: allowed = true');
console.log('Pass:', test8Result.allowed === true ? '✓' : '✗');
console.log('---\n');

// Test 9: CRM - Contact with legal basis (should pass)
console.log('TEST 9: CRM Kontakt med lovligt grundlag (should pass)');
const test9Prospect = {
    id: 'prospect_3',
    hasContract: true,
    contactType: 'email',
    purpose: 'customer_service'
};
const test9Result = canContact(test9Prospect, 'email');
console.log('Allowed:', test9Result.allowed);
console.log('Blocked:', test9Result.blocked);
console.log('Message:', test9Result.message);
console.log('Expected: allowed = true');
console.log('Pass:', test9Result.allowed === true ? '✓' : '✗');
console.log('---\n');

// Test 10: CRM - Contact without legal basis (should fail)
console.log('TEST 10: CRM Kontakt uden lovligt grundlag (should fail)');
const test10Prospect = {
    id: 'prospect_4',
    hasConsent: false,
    hasContract: false,
    hasLegitimateInterest: false,
    contactType: 'email'
};
const test10Result = canContact(test10Prospect, 'email');
console.log('Allowed:', test10Result.allowed);
console.log('Blocked:', test10Result.blocked);
console.log('Message:', test10Result.message);
console.log('Expected: blocked = true');
console.log('Pass:', test10Result.blocked === true ? '✓' : '✗');
console.log('Details:', JSON.stringify(test10Result.details, null, 2));
console.log('---\n');

console.log('=== TEST SUITE COMPLETE ===');
