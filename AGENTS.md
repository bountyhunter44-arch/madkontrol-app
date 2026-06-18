# Madkontrollen AI Agent Rules

Before writing code, always read:

1. tools/project-registry.md
2. tools/feature-registry.json
3. tools/security-no-go.md
4. tools/audit-checklist.md
5. The relevant tools/*.registry.md for the module being changed

Hard rules:
- Do not create duplicate flows.
- Do not work in deprecated files.
- Do not deploy unless explicitly instructed.
- Do not write to Firestore unless explicitly instructed.
- Do not hard-delete runtime data.
- Do not change mn@madkontrollen.dk companyId/locationId.
- Do not change Supawan/Aroi-D canonical scope without explicit approval.
- Update registry files when changing architecture, flows, security, onboarding, support mode, deploy behavior, or module provisioning.

If registry and code disagree:
STOP and report the mismatch before changing code.

---

## Concrete values & active pointers (do not lose these)

**Protected identities / scope:**
- Platform admin: `mn@madkontrollen.dk` / uid `oQNTYi5NRdW1r0QHKW7FcwDGks52` — must stay tenant-less
  (no companyId/locationId); recognized at runtime via `public/core/platform-admin.js` `isPlatformAdmin()`.
- Aroi-D canonical: companyId `onboarding_aroi-d_42405000`, location `onboarding_aroi-d_42405000__main`,
  Supawan uid `HNcGHMrzsUPqbyBcmodsxBuWuJc2`, email `supawan@aroid.dk`.

**Deploy:**
- Firebase project `madkontrollen`; repo `D:\madkontrol-app`.
- Hosting deploys from the clean-room `D:\mk-deploy-focused` (not the dirty repo).
- Functions/rules deploys require a separate, explicit GO. The user runs all deploys.

**Active flows:**
- Egenkontrol: `public/modules/egenkontrol/{rutiner,rapporter,afvigelser,luk-dag}.html`;
  engine `functions/canonicalTaskEngine.js` + `functions/js/setupToCanonicalRoutines.js`.
- Onboarding (active = Quick Onboarding): `public/quick-onboarding.html` +
  `createQuickOnboardingAccount` / `completeQuickOnboarding` / `finalizeOnboardingCheckoutProvisioning`;
  module map `functions/modules/onboarding/moduleProvisioners.js`.
- Platform admin / support: `public/admin/owner-dashboard.html`, `public/core/platform-admin.js`,
  `public/platform/context-provider.js`; audit `platform_admin_audit`; support model →
  `platform_support_sessions` (read-only default). `mkp_impersonate_*` is deprecated.

**Soft-archive (never hard-delete):**
`active:false, isActive:false, archived:true, status:"inactive", archivedReason, archivedAt`.

**Equipment rule:** no cold/freezer/temperature routine/template/instance without a concrete
`equipmentId/unitId/equipmentName/unitName`; no generic "Fryser temperatur"/"Køleskab temperatur".

**Verify:** `node --check` every changed JS file (and HTML inline scripts); if `firestore.rules` changed,
run the brace/paren balance + read/write impact audit. Show diffs before any deploy.
