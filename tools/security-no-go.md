# Security — NO-GO conditions

A change is **NO-GO** (do not ship / do not deploy) if any of the following is true:

1. **Hard-delete in deployable frontend/functions runtime.** Only soft-archive
   (`active:false,isActive:false,archived:true,status:"inactive",archivedReason,archivedAt`) is allowed.
2. **Ordinary impersonation used as support-mode.** `mkp_impersonate_*` is deprecated; support must use
   `platform_support_sessions/{sessionId}` with `readOnlySupport:true` default + audit (see
   `platform-admin-support.registry.md`).
3. **`mn@madkontrollen.dk` gets a `companyId`/`locationId`.** Platform-admin must stay tenant-less;
   recognition is runtime-only (`isPlatformAdmin`).
4. **Supawan/Aroi-D canonical scope changed without explicit approval** (companyId
   `onboarding_aroi-d_42405000`, location `…__main`, uid `HNcGHMrz…`).
5. **Firestore rules opened broadly for super-admin without an audit** (e.g. widening read/list/write,
   adding emails to `isSuperAdmin()` allowlist, removing scope checks).
6. **`express` removed while `server/` still requires express** (or any dependency removed while a
   runtime still imports it).
7. **`public/scripts/delete*` or seed/reset scripts present in hosting scope** (they must not ship in
   `public/` / the clean-room).
8. **Generic cold/freezer routines created without equipment** (no `equipmentId/unitId/equipmentName/
   unitName`). Enforced by `shouldSkipMissingEquipmentRoutine()`.

## Also treat as NO-GO until audited
- Bundling rules/functions deploy into a hosting deploy without separate GO.
- Deploying the dirty repo instead of the clean-room.
- Blind overwrite of existing docs (always merge / guard before write).
