# Madkontrollen Pro — Project Registry

> **Read this first** before any larger code change. **Update it after.** This `tools/` folder is the
> project's durable memory: active architecture, active flows, and known security rules.

## Core facts
- **Project:** Madkontrollen Pro
- **Active Firebase project:** `madkontrollen`
- **Active repo:** `D:\madkontrol-app`
- **Clean hosting deploy folder:** `D:\mk-deploy-focused`
- **Hosting deploy MUST come from the clean-room (`D:\mk-deploy-focused`), not the dirty repo.**
  The working tree contains many uncommitted/unrelated changes; deploying it ships all of them.
- **Functions/rules deploy requires a separate, explicit GO** (never bundled with a hosting deploy).

## Platform admin
- **email:** `mn@madkontrollen.dk`
- **uid:** `oQNTYi5NRdW1r0QHKW7FcwDGks52`
- **MUST NOT have `companyId`/`locationId`.** Platform-admin is recognized at runtime only
  (`public/core/platform-admin.js` → `isPlatformAdmin()`), never by writing tenant scope on the user doc.
- Recognized via: uid/email allowlist, `role == "super-admin"`, `platformRole == "super_admin"`,
  `isSuperAdmin == true`, `isPlatformAdmin == true`, `crmAccess == true`.
- Frontend allowlists also list this email: `public/admin/owner-dashboard.html` `SUPER_ADMIN_EMAILS`
  and `firestore.rules` `isSuperAdmin()` email allowlist.

## Aroi-D canonical scope — DO NOT change without explicit audit/approval
- **companyId:** `onboarding_aroi-d_42405000`
- **locationId:** `onboarding_aroi-d_42405000__main`
- **Supawan UID:** `HNcGHMrzsUPqbyBcmodsxBuWuJc2`
- **Supawan email:** `supawan@aroid.dk`
- This is the ONE real active customer (egenkontrol). Its canonical masterdata (equipment +
  per-unit templates) was restored deliberately. Never repoint, overwrite, or delete it.

## Registry files
| File | Purpose |
|------|---------|
| `project-registry.md` | This file — core facts, scopes, identities |
| `feature-registry.json` | Per-module active files / functions / collections / no-go rules |
| `egenkontrol.registry.md` | Egenkontrol runtime, engine, equipment/actor rules |
| `onboarding.registry.md` | Active Quick Onboarding flow + provisioning rules |
| `platform-admin-support.registry.md` | Support/"Se som kunde" model + no-go |
| `deploy-registry.md` | Hosting/rules/functions deploy procedure |
| `security-no-go.md` | Hard NO-GO conditions |
| `audit-checklist.md` | Per-change checklist |

## Process rule
1. Read the relevant registry file(s) before changing code.
2. Run the `audit-checklist.md` checks.
3. Update the registry file(s) after the change (active vs deprecated, new no-go, new collection).
