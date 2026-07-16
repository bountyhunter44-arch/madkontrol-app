# Module Verification Checklist

Use this before any module feature work starts and again before handoff.

## Before Changes

- Read `tools/*`, relevant registries, module docs, and dependency maps.
- Identify the exact module owner and source of truth.
- Confirm the module has:
  - `module.json`
  - `README.md`
  - `verification.md`
- State expected changed files before editing.
- State impacted dependencies before editing.
- State impacted Firestore collections before editing.
- State impacted routes before editing.
- Confirm no unrelated modules are in scope.
- Confirm no Core internals are imported by standalone apps unless the module explicitly owns Core.

## Implementation Boundaries

- Work on one module at a time.
- Do not begin the next module until current module verification is complete.
- Prefer existing contracts, shared platform APIs, and module-local services.
- Avoid duplicate helpers and patchwork.
- Do not change auth, Stripe, SEO, gateway, or platform behavior unless listed in scope.

## Required Checks

- UI works at desktop width.
- UI works at 390px mobile width.
- Empty/loading/error states are present.
- Data create/read/update/delete works for scoped `companyId` and `locationId`.
- Entitlement/context behavior is verified.
- Debug panels are hidden unless explicitly enabled.
- No raw JSON or developer-only panels appear in normal UI.
- `node --check` passes for changed JavaScript files.
- Relevant smoke tests are run and documented.

## Handoff Output

- Files changed.
- Collections changed.
- Routes changed.
- Dependencies changed.
- Verification performed.
- Deploy performed or explicitly skipped.
- Smoke-test results.
- `git status --short`.
- Checkpoint commit hash if created.
