# Platform Admin Support / "Se som kunde" — Registry

## Current state (honest)
- `public/admin/owner-dashboard.html` "Se som kunde" currently reuses the OLD impersonation
  (`sessionStorage` keys `mkp_impersonate_*`) handled by `dashboard.html` (`isImpersonating()`).
- afvigelser.html supports admin support reads via `?adminCompanyId/adminLocationId/deviationId`
  (platform-admin only; banner shown; `contextType:"admin_support"` on `SETTINGS.adminSupportContext`).

## Target model (preferred going forward)
- **`mkp_impersonate_*` is DEPRECATED.** Old generic impersonation must not be the support mechanism.
- **Right model:** `platform_support_sessions/{sessionId}`
  - `contextType: "admin_support"`
  - `readOnlySupport: true` **as default**
  - `allowedModules: [...]`  (only Madkontrollen's own modules)
  - audit: `start` / `open` / `end` events (who, when, which company/location)
  - **clear banner** while a support session is active ("Admin-support: Du ser [company]") + "Afslut".
- Audit trail collection already present: `platform_admin_audit/{autoId}`
  (`action:"admin_preview_company"`, super-admin only, append-only).

## Hard rules
- Support-app may ONLY grant access to **Madkontrollen's own modules**.
- MUST NOT give access to the customer's PC, files, or any other system.
- MUST NOT write `companyId`/`locationId` onto `mn@madkontrollen.dk` (or any platform-admin).
- Default to **read-only** support; writes require explicit elevation + audit.
- Never touch Supawan/Aroi-D canonical scope during support.

## Migration TODO
- Replace `mkp_impersonate_*` with `platform_support_sessions/{sessionId}` + `readOnlySupport`.
- Gate write-capability behind an explicit elevation flag (audited), default read-only.
