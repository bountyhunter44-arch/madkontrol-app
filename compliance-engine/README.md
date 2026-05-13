# Compliance Engine

Domain-agnostic compliance evaluation engine for policy-based decision making.

## Architecture

```
compliance-engine/
├── core/                    # Domain-agnostic core
│   ├── evaluator.js        # Policy evaluation logic
│   ├── router.js           # Policy box routing
│   └── signal-factory.js   # User-facing messages
├── registry/               # Policy definitions
│   ├── index.js           # Central registry
│   └── boxes/             # Policy boxes by domain
│       ├── food_safety.js
│       ├── gdpr_privacy.js
│       └── financial_limits.js
├── adapters/              # App-specific adapters
│   ├── madkontrol-ui.js  # Madkontrol task adapter
│   └── crm-connector.js  # CRM prospect adapter
└── test/                 # Test suite
    └── test-runner.js
```

## Core Principles

1. **Domain-agnostic core**: No hardcoded business logic in core modules
2. **Policy boxes**: Self-contained rule sets with clear boundaries
3. **Adapters**: Translate app-specific data to compliance input
4. **Composable**: Mix and match policy boxes as needed

## Scoring Model

```javascript
finalScore = 
  0.40 * embedding_score +
  0.20 * logprob_confidence +
  0.40 * policy_match
```

## Policy Gates

| Policy Match | Gate | Action |
|-------------|------|--------|
| < 0.15 | `hard_block` | Reject |
| 0.15 - 0.45 | `manual_review` | Review required |
| 0.45 - 0.75 | `warning` | Warn user |
| ≥ 0.75 | `ok` | Approve |

## Usage

### Madkontrol Tasks

```javascript
const { evaluateMadkontrolTask } = require('./adapters/madkontrol-ui');

const task = {
  id: 'task_123',
  routineType: 'opvarmning',
  heatingRuns: [{ finalTemperature: 78 }]
};

const entryData = {
  measurementValue: 78
};

const report = evaluateMadkontrolTask(task, entryData);

console.log(report.gate);        // 'ok'
console.log(report.message);     // ''
console.log(report.action);      // 'approve'
```

### CRM Prospects

```javascript
const { canContact } = require('./adapters/crm-connector');

const prospect = {
  id: 'prospect_123',
  hasMarketingConsent: true,
  consentTimestamp: '2024-01-01T00:00:00Z'
};

const result = canContact(prospect, 'marketing');

console.log(result.allowed);     // true
console.log(result.blocked);     // false
console.log(result.message);     // ''
```

## Policy Boxes

### Food Safety

- **Reheating**: ≥75°C
- **Hot Holding**: ≥65°C
- **Cooling**: 65°C → 10°C within 4 hours
- **Goods Receiving**: Cold ≤5°C, Frozen ≤-18°C

### GDPR Privacy

- **Contact Legal Basis**: Consent, contract, or legitimate interest required
- **Marketing Consent**: Explicit consent with timestamp
- **Data Retention**: Respect retention periods
- **Data Minimization**: Only collect necessary fields

### Financial Limits

- **Payment Validation**: Positive amounts, reasonable limits
- **Credit Control**: Credit limit enforcement, utilization warnings
- **Invoice Validation**: Recipient, due date, future date checks

## Testing

```bash
node compliance-engine/test/test-runner.js
```

Expected output:
- ✓ Opvarmning 56°C → hard_block/manual_review
- ✓ Opvarmning 78°C → ok
- ✓ Varmholdelse 56°C → hard_block/manual_review
- ✓ Varmholdelse 68°C → ok
- ✓ Nedkøling within limits → ok
- ✓ Nedkøling too slow → hard_block/manual_review
- ✓ CRM marketing without consent → blocked
- ✓ CRM marketing with consent → allowed
- ✓ CRM contact with legal basis → allowed
- ✓ CRM contact without legal basis → blocked

## Adding New Policy Boxes

1. Create policy box in `registry/boxes/`
2. Define rules with `evaluate()` functions
3. Add to registry in `registry/index.js`
4. Create adapter if needed in `adapters/`

Example:

```javascript
// registry/boxes/my_domain.js
module.exports = [
  {
    id: 'my_policy_box',
    name: 'My Policy Box',
    domain: 'my_domain',
    ruleFamily: 'my_rules',
    tags: ['tag1', 'tag2'],
    rules: [
      {
        id: 'my_rule',
        message: 'Rule description',
        severity: 'critical',
        evaluate: (input) => {
          const passed = input.value >= 10;
          return {
            passed,
            message: passed ? 'OK' : 'Failed',
            value: input.value,
            threshold: 10
          };
        }
      }
    ]
  }
];
```

## Integration

### With Madkontrol UI

```javascript
// In rutiner.html or task handler
const { shouldCreateDeviation } = require('./compliance-engine/adapters/madkontrol-ui');

const deviationCheck = shouldCreateDeviation(task, entryData);

if (deviationCheck.shouldCreate) {
  // Create deviation with deviationCheck.message and deviationCheck.details
}
```

### With CRM

```javascript
// In CRM contact handler
const { canContact } = require('./compliance-engine/adapters/crm-connector');

const permission = canContact(prospect, 'marketing');

if (permission.blocked) {
  // Block contact, show permission.message
} else if (permission.requiresReview) {
  // Queue for manual review
} else {
  // Proceed with contact
}
```

## Design Decisions

- **No Firebase in core**: All persistence handled by adapters
- **No UI in core**: Signal factory returns data, not HTML
- **No auto-approve**: Always return decision, let caller decide action
- **CommonJS modules**: Consistent with project style
- **Synchronous evaluation**: Fast, deterministic, no async needed for rules

## Future Enhancements

- [ ] Rule versioning and audit trail
- [ ] Policy box dependencies and composition
- [ ] Custom scoring weights per domain
- [ ] Rule explanation generation
- [ ] Policy box testing framework
- [ ] Integration with AI/ML scoring services
