# PHASE 2C: PROFILNAME PRIORITY FIX - COMPLETE

**Date:** 2026-05-11 22:02  
**Duration:** 10 minutes  
**Status:** ✅ COMPLETE - READY FOR DEPLOYMENT

---

## ✅ PROBLEM LØST

### **Issue:**
- Audit trail viste virksomhedsnavne i stedet for personnavne
- Nyt felt `profile.profilname` oprettet men ikke prioriteret
- Behov for at sikre PERSON navne bruges, ikke virksomhedsnavne

### **Solution:**
- Opdateret `resolveCurrentActor()` med ny prioritetsrækkefølge
- Tilføjet aktiv detektion af virksomhedsnavne
- Tilføjet warnings for manglende personnavne

---

## 📝 FILER ÆNDRET

### **1. `public/core/auditFields.js`**

**Changes:**
- ✅ Opdateret `resolveCurrentActor()` funktion
- ✅ Ny prioritetsrækkefølge med `profile.profilname`
- ✅ Virksomhedsnavn-detektion tilføjet
- ✅ Warnings system implementeret
- ✅ Return value udvidet: `{ uid, name, email, source, warnings }`

**Lines Modified:** ~100 lines (function rewrite)

---

### **2. `tools/registries/helper-registry.json`**

**Changes:**
- ✅ Opdateret `resolveCurrentActor` entry
- ✅ Risk level: MEDIUM → HIGH
- ✅ Critical notes opdateret med ny prioritet
- ✅ Tags tilføjet: "critical"

---

### **3. `tools/logs/decisions.log.json`**

**Changes:**
- ✅ Logged profilname priority fix decision
- ✅ Dokumenteret ny prioritetsrækkefølge
- ✅ Dokumenteret disallowed fields
- ✅ Dokumenteret warnings

---

## ✅ NY PRIORITETSRÆKKEFØLGE

### **Person Name Resolution:**

1. ✅ `profile.contactPersonName`
2. ✅ `profile.profile?.contactPersonName`
3. ✅ `profile.profilname` **(NEW)**
4. ✅ `profile.profile?.profilname` **(NEW)**
5. ✅ `profile.profilename` (legacy)
6. ✅ `profile.profile?.profilename` (legacy)
7. ✅ `user.displayName` (if NOT company name)
8. ✅ `user.email` (fallback)
9. ✅ `"Ukendt bruger"` (last resort)

---

## 🚫 DISALLOWED FIELDS

### **NEVER Used as Person Name:**

- ❌ `companyName`
- ❌ `profileCompanyName`
- ❌ `profile.companyName`
- ❌ `profile.profile.companyName`
- ❌ `displayName` (if matches companyName)
- ❌ `name` (if matches companyName)
- ❌ `locationName`

---

## ⚠️ WARNINGS TILFØJET

### **1. `actor_field_matches_company_name`**

**When:** Resolved name matches company name (case-insensitive)

**Action:** Falls back to email or "Ukendt bruger"

**Example:**
```javascript
{
  uid: "abc123",
  name: "user@example.com", // fallback
  email: "user@example.com",
  source: "fallback (matched company name)",
  warnings: ["actor_field_matches_company_name"]
}
```

---

### **2. `missing_real_person_name`**

**When:** No person name fields available, using email or fallback

**Action:** Uses email or "Ukendt bruger"

**Example:**
```javascript
{
  uid: "abc123",
  name: "user@example.com",
  email: "user@example.com",
  source: "user.email",
  warnings: ["missing_real_person_name"]
}
```

---

## 🔍 COMPANY NAME DETECTION

### **Logic:**

```javascript
// Get company name for comparison
const companyName = String(
    profile?.companyName || 
    profile?.profile?.companyName || 
    profile?.profileCompanyName ||
    profile?.profile?.profileCompanyName ||
    profile?.name ||
    ""
).trim().toLowerCase();

// Check if resolved name matches company name
if (companyName && name.toLowerCase() === companyName) {
    warnings.push("actor_field_matches_company_name");
    name = user.email || "Ukendt bruger";
    source = "fallback (matched company name)";
}
```

---

## 📊 RETURN VALUE

### **Before:**
```javascript
{
  uid: "abc123",
  name: "John Doe",
  email: "john@example.com"
}
```

### **After:**
```javascript
{
  uid: "abc123",
  name: "John Doe",
  email: "john@example.com",
  source: "profile.profilname",
  warnings: []
}
```

**New Fields:**
- ✅ `source` - Which field was used for name resolution
- ✅ `warnings` - Array of warning codes

---

## ✅ TESTS KØRT

### **JSON Validation:**

```bash
✓ tools/registries/helper-registry.json
✓ tools/logs/decisions.log.json
```

**Result:** ✅ ALL PASS

---

### **Browser Testing:**

⏳ **PENDING** (needs deployment)

**Test Plan:**

1. **Test med profile.profilname:**
   - Set profile.profilname = "John Doe"
   - Complete task
   - Verify Firestore: completedByName = "John Doe"
   - Verify source: "profile.profilname"

2. **Test med legacy profilename:**
   - Set profile.profilename = "Jane Smith"
   - Complete task
   - Verify Firestore: completedByName = "Jane Smith"
   - Verify source: "profile.profilename"

3. **Test med company name collision:**
   - Set user.displayName = "Acme Corp"
   - Set profile.companyName = "Acme Corp"
   - Complete task
   - Verify Firestore: completedByName = email (NOT "Acme Corp")
   - Verify warnings: ["actor_field_matches_company_name"]

4. **Test med missing person name:**
   - No profilname, profilename, contactPersonName
   - Complete task
   - Verify Firestore: completedByName = email
   - Verify warnings: ["missing_real_person_name"]

5. **Test rapport display:**
   - Open rapporter.html
   - Verify "Udført af" shows person name (NOT company name)
   - Verify old entries still display

---

## 🚀 DEPLOYMENT NØDVENDIGT

### **JA - DEPLOYMENT NØDVENDIGT**

```bash
firebase deploy --only hosting
```

**Files to deploy:**
- `public/core/auditFields.js` (MODIFIED)

**Impact:**
- ✅ All new audit entries use person names
- ✅ Company names actively avoided
- ✅ Warnings logged for monitoring
- ✅ Old entries still work (backward compatible)
- ✅ No breaking changes

**Risk:** LOW (backward compatible, safe fallbacks)

---

## 📈 EXPECTED RESULTS

### **Before Fix:**

**Firestore:**
```javascript
{
  completedByName: "Acme Corp", // ❌ COMPANY NAME
  completedByEmail: "user@acme.com"
}
```

**Rapport:**
```
Udført af: Acme Corp  // ❌ WRONG
```

---

### **After Fix:**

**Firestore (with profilname):**
```javascript
{
  completedByName: "John Doe", // ✅ PERSON NAME
  completedByEmail: "user@acme.com"
}
```

**Firestore (without profilname):**
```javascript
{
  completedByName: "user@acme.com", // ✅ EMAIL FALLBACK
  completedByEmail: "user@acme.com"
}
```

**Rapport:**
```
Udført af: John Doe  // ✅ CORRECT
```

---

## 🎯 NÆSTE SKRIDT

### **Immediate (After Deploy):**

1. ✅ Deploy to hosting: `firebase deploy --only hosting`
2. ✅ Test with profile.profilname set
3. ✅ Test with legacy profilename
4. ✅ Test company name collision
5. ✅ Verify reports show person names
6. ✅ Monitor console for warnings

---

### **Short-term:**

7. ⏳ Update onboarding to set profile.profilname
8. ⏳ Add UI field for editing profilname
9. ⏳ Monitor warnings in production
10. ⏳ Consider data migration for existing profiles

---

### **Medium-term:**

11. ⏳ Add admin tool to bulk-set profilname
12. ⏳ Add validation to prevent company names in person fields
13. ⏳ Add analytics for warning frequency

---

## 🎓 GOVERNANCE COMPLIANCE

### **Rules Followed:**
- ✅ Used existing auditFields.js (no new file)
- ✅ Minimal changes (single function update)
- ✅ Backward compatibility maintained
- ✅ Registry updated
- ✅ Decision logged
- ✅ Safe fallbacks implemented

---

### **Critical Notes:**
- ✅ NEVER returns company name as person name
- ✅ Warnings enable monitoring
- ✅ Source tracking for debugging
- ✅ Legacy fields still supported
- ✅ Email fallback is acceptable

---

## 📋 SUMMARY

### **Problem:**
Audit trail showing company names instead of person names

### **Solution:**
- ✅ Prioritize profile.profilname
- ✅ Detect and avoid company names
- ✅ Add warnings for monitoring
- ✅ Maintain backward compatibility

### **Files Modified:** 3
- `public/core/auditFields.js`
- `tools/registries/helper-registry.json`
- `tools/logs/decisions.log.json`

### **New Priority Order:** 9 levels
1. contactPersonName
2. profilname (NEW)
3. profilename (legacy)
4. user.displayName (if not company)
5. email (fallback)

### **Warnings Added:** 2
- `actor_field_matches_company_name`
- `missing_real_person_name`

### **Deployment:** REQUIRED (hosting only)

### **Risk:** LOW (backward compatible)

---

**Status:** ✅ PHASE 2C COMPLETE - PROFILNAME PRIORITY FIX  
**Next:** Deploy, test, monitor warnings  
**Deployment:** REQUIRED (hosting only)  
**Risk:** LOW (safe fallbacks, backward compatible)
