# PHASE 2: SURGICAL CLEANUP CANDIDATES

**Date:** 2026-05-11  
**Status:** IDENTIFIED - NOT EXECUTED

---

## ⚠️ CRITICAL NOTICE

**NO CLEANUPS HAVE BEEN EXECUTED YET**

All items below are CANDIDATES only. Each requires:
1. 100% confirmation of duplicate/unused status
2. Runtime usage verification
3. Syntax/import check
4. Trivial rollback plan
5. Test plan

---

## 🔍 DUPLICATE RISK CANDIDATES

### CANDIDATE 1: Inline org context resolution

**Problem:** Multiple files may have inline `companyId || organizationId` fallback logic instead of using `resolveOrgContext`

**Evidens:**
- Found 34 matches of `companyId.*organizationId` pattern across 21 files
- Files include: debug-profile.html, start-dag.html, owner-dashboard.html, etc.

**Berørte filer:**
- `public/debug-profile.html` (5 matches)
- `public/modules/egenkontrol/start-dag.html` (3 matches)
- `public/admin/owner-dashboard.html` (2 matches)
- `public/dashboard.html` (2 matches)
- And 17 more files

**Risiko:** MEDIUM
- May be legitimate usage in some cases
- Need to verify each instance
- Some may be necessary for specific contexts

**Foreslået kirurgisk ændring:**
1. Review each match individually
2. Determine if it should use `resolveOrgContext`
3. Replace inline logic with function call
4. Test affected page

**Rollback:** 
- Git revert
- Each file independent

**Test:**
- Load each affected page
- Verify companyId/locationId resolution
- Check auth flow
- Verify session persistence

**Status:** NEEDS INVESTIGATION
**Next:** Manual review of each instance

---

### CANDIDATE 2: Potential duplicate profile lookup

**Problem:** Multiple files may query users collection by uid or email

**Evidens:**
- `auth.js::getUserRoleProfile` queries users by uid and email
- `layout.js::getCurrentUserProfile` queries users by uid and email
- Potential duplication

**Berørte filer:**
- `public/core/auth.js:610`
- `public/core/layout.js:62`

**Risiko:** LOW
- Both functions may serve different purposes
- Need to verify usage context

**Foreslået kirurgisk ændring:**
1. Verify if both are needed
2. If duplicate, consolidate to auth.js
3. Update layout.js to import from auth.js

**Rollback:**
- Git revert
- Simple function replacement

**Test:**
- Auth flow
- Layout loading
- Profile resolution

**Status:** NEEDS INVESTIGATION
**Next:** Compare function implementations and usage

---

### CANDIDATE 3: Empty core files

**Problem:** Several core files are empty (0 bytes)

**Evidens:**
- `public/core/ai.js` (0 bytes)
- `public/core/notifications.js` (0 bytes)
- `public/core/tasks.js` (0 bytes)

**Berørte filer:**
- `public/core/ai.js`
- `public/core/notifications.js`
- `public/core/tasks.js`

**Risiko:** LOW
- May be placeholders for future features
- May be imported somewhere (need to check)

**Foreslået kirurgisk ændring:**
1. Search for imports of these files
2. If no imports found, consider removing
3. If imports found, add TODO comment

**Rollback:**
- Git revert
- Files can be recreated if needed

**Test:**
- Grep for imports
- Check if any page breaks

**Status:** SAFE TO INVESTIGATE
**Next:** Search for imports

---

## 📝 DOCUMENTATION CANDIDATES

### CANDIDATE 4: Add JSDoc to critical helpers

**Problem:** Critical helpers lack comprehensive JSDoc documentation

**Evidens:**
- `resolveOrgContext` has comment but no @param/@returns
- `resolvePrettyCompanyInfo` has no JSDoc
- `resolveTaskTitle` has comment but incomplete

**Berørte filer:**
- `public/core/auth.js`
- `public/core/prettyName.js`
- `public/core/taskTitleResolver.js`

**Risiko:** NONE (documentation only)

**Foreslået kirurgisk ændring:**
1. Add comprehensive JSDoc to each function
2. Document parameters, returns, examples
3. Document critical rules

**Rollback:**
- Git revert
- Documentation only, no logic change

**Test:**
- No runtime testing needed
- Verify JSDoc syntax

**Status:** SAFE TO EXECUTE
**Next:** Add JSDoc comments

---

## 🚫 NOT CANDIDATES (DO NOT TOUCH)

### ❌ Canonical routine types
- **Why:** HACCP compliance, backend sync required
- **Status:** DO NOT MODIFY

### ❌ prettyName priority order
- **Why:** Critical rule, complex fallback chain
- **Status:** DO NOT MODIFY

### ❌ Cooling/hot holding validation
- **Why:** Food safety compliance
- **Status:** DO NOT MODIFY

### ❌ Auth gate redirect logic
- **Why:** Onboarding flow critical
- **Status:** DO NOT MODIFY

---

## 📊 SUMMARY

### Total Candidates: 4
- Duplicate risk: 2 (NEEDS INVESTIGATION)
- Empty files: 1 (SAFE TO INVESTIGATE)
- Documentation: 1 (SAFE TO EXECUTE)

### Executed: 0
### Pending investigation: 3
### Safe to execute: 1

---

## 🎯 NEXT STEPS

1. **Investigate inline org context** (CANDIDATE 1)
   - Review each of 34 matches
   - Determine if legitimate or duplicate
   - Create specific cleanup plan

2. **Investigate profile lookup** (CANDIDATE 2)
   - Compare implementations
   - Verify usage context
   - Determine if consolidation needed

3. **Check empty files** (CANDIDATE 3)
   - Search for imports
   - Verify if used
   - Remove or document

4. **Add JSDoc** (CANDIDATE 4)
   - Safe to execute
   - No logic changes
   - Improves maintainability

---

**Status:** Candidates identified, awaiting investigation  
**Execution:** NONE yet  
**Next:** Investigate CANDIDATE 1
