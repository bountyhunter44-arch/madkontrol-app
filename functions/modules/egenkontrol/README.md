# Egenkontrol Backend Module

This folder is the target home for backend-only Egenkontrol functions.

Current phase:
- `closeDailyRun` is re-exported through `reports.js` after export parity was checked.
- Process/cooling callables are re-exported through `processes.js` after export parity was checked.
- Move only one low-risk Firebase function/helper at a time.
- Do not touch Stripe, checkout, webhook, or onboarding provisioning flows from this module.
- Keep existing exported function names stable.

Proposed split:
- `routines.js`: routine save, daily start, periods, pause/day state, task instances.
- `reports.js`: dashboard/report data and authority reporting helpers.
- `processes.js`: cooling/reheating process callable wrappers backed by `functions/processInstances.js`.
- `risk-analysis.js`: HACCP/risk snapshot generation and risk-to-template helpers.
- `templates.js`: task template generation, cleanup, regeneration, canonical templates.
- `deviations.js`: deviations and corrective-action helpers.
- `services/`: Firestore/service orchestration.
- `helpers/`: small pure helpers shared by the module.
- `domain/`: domain constants, schemas and value normalizers.

Root `functions/index.js` remains the Firebase export owner and re-exports stable function names.
