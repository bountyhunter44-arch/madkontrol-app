# Madkontrollen Pro - AI Toolbox Contract

This contract is the first file every AI coding agent must read before editing Madkontrollen Pro. It exists to keep Codex, Windsurfer, OpenCode, and other agents aligned with the existing architecture, canonical systems, helper registry, and protected flows.

## 1. CORE PRINCIPLES

- Toolbox-first: read this toolbox and the relevant registry stamps before touching files.
- Reuse-first: search for an existing helper, resolver, workflow, or canonical model before creating anything new.
- Canonical-first: canonical task, audit, reporting, onboarding, and naming contracts win over local inline logic.
- Small diff policy: change the smallest safe surface needed for the requested task.
- No duplicate helpers: do not create a second resolver, mapper, save helper, or fallback chain when a registered helper exists.
- No parallel onboarding systems: onboarding, quick onboarding, checkout provisioning, and live profile writes must stay on the existing flows.
- Verify before deploy: run the smallest meaningful verification before any deployment request is executed.
- No Stripe/Auth/Rules changes without explicit instruction: protected systems require a direct user request and a narrow diff.

## 2. CRITICAL SYSTEMS

- Canonical task engine: owns task template and task instance generation rules, dedupe, routine identity, and day-start behavior.
- Onboarding: owns full onboarding state collection, checkout handoff, company/location/profile contract, and generated control context.
- Quick onboarding: owns lightweight account creation and provisioning while preserving the same profile and audit contracts.
- Stripe: owns checkout sessions, webhook fulfillment, subscription status, billing metadata, and payment-triggered provisioning.
- task_templates: canonical scheduled control templates. Avoid duplicate template creation and preserve routine identity fields.
- task_instances: daily/periodic executable controls. Preserve dedupe keys, status semantics, audit fields, and date/location scope.
- haccp_snapshots: authority-facing HACCP/risk snapshot source. Do not fork snapshot structure or report rendering assumptions.
- Authority reports: use registered report resolvers, audit actor normalization, task title resolution, and prettyName data.
- Audit contracts: create and complete audit metadata through official helpers. Company names must not be treated as employee names.
- prettyName system: canonical company/location display resolver. Preserve priority order and live_user_profiles fallback behavior.

## 3. OFFICIAL HELPERS

- createAuditCompleteFields: official completion audit writer helper from `public/core/auditFields.js`.
- resolveEntryActor: official report actor resolver from `public/core/reportEntryResolver.js`.
- resolveTaskTitle: official task title resolver from `public/core/taskTitleResolver.js`.
- PrettyName helpers: `resolvePrettyCompanyInfo`, `resolveCompanyIdFromUserData`, and `resolveLocationIdFromUserData`.
- Risk analysis helpers: reuse the existing risk analysis services, renderers, builders, and mapping helpers under `public/modules/egenkontrol/`.
- Canonical task helpers: reuse canonical task/routine normalizers, title mappers, and engine helpers before adding new mappings.

## 4. PROTECTED SYSTEMS

Do not change these without an explicit task naming that system:

- Stripe webhook
- Auth flow
- Firestore rules
- live_user_profiles contract
- Subscription handling

When a protected system must be touched, read its registry stamp, inspect existing helpers, document the risk, and keep the diff surgical.

## 5. FILE OWNERSHIP PRINCIPLE

Every critical file should carry a registry stamp with:

- Role: the file's architectural purpose.
- Responsibilities: what the file owns and what downstream flows depend on it for.
- Helper usage: registered helpers, resolvers, engines, or contracts the file uses.
- Forbidden duplicates: helpers, fallbacks, writes, engines, or flows that must not be recreated locally.

Standard stamp format:

```js
/**
 * @madkontrollen-registry-stamp
 * fileRole: "routine-ui"
 * projectArea: "egenkontrol"
 * canonicalSystem: true
 * usesHelpers:
 *   - createAuditCompleteFields
 *   - resolveEntryActor
 * owns:
 *   - routine rendering
 *   - task completion flow
 * mustNotCreate:
 *   - duplicate audit helpers
 *   - duplicate save helpers
 * requiredBeforeEdit:
 *   - read docs/AI_TOOLBOX.md
 *   - inspect existing helpers
 */
```

For HTML files, use the same fields inside an HTML comment near the top of the document, after the doctype.

## 6. AI EDITING RULES

AI agents must always:

- Read `docs/AI_TOOLBOX.md` first.
- Read relevant registry stamps before editing a stamped file.
- Search for an existing helper before creating a new helper.
- Verify canonical mappings before changing task, routine, audit, report, or onboarding behavior.
- Use existing audit contracts instead of inline audit field construction.
- Make the smallest safe diff possible.

## 7. FUTURE AI CONTRACT

All future AI prompts should begin with:

1. Read `docs/AI_TOOLBOX.md`.
2. Read relevant registry stamps.
3. Search for reusable helpers.
4. Verify canonical ownership.
5. Avoid duplicate flows/helpers.
6. Make smallest safe diff possible.
