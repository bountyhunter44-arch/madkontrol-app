# PHASE 2: NEXT SAFE MIGRATION STEP

**Date:** 2026-05-11  
**Current Status:** Foundation complete, resolver created  
**Next Phase:** Gradual migration to rapporter.html

---

## ✅ FOUNDATION COMPLETE

- ✅ `reportEntryResolver.js` created (10 functions)
- ✅ Test data created (15 test cases)
- ✅ Documentation complete
- ✅ Registries updated
- ✅ Decision logged
- ✅ JS syntax validated
- ✅ JSON validated
- ✅ No runtime changes made

---

## 🎯 NEXT SAFE STEP: IMPORT ONLY (LOW RISK)

### **Step 1: Add Import Statement**

**File:** `public/modules/egenkontrol/rapporter.html`

**Location:** After existing imports (around line 850-860)

**Add:**
```javascript
import { normalizeReportEntry } from '/core/reportEntryResolver.js';
```

**Risk:** LOW  
**Why Safe:** Import only, no usage yet  
**Duration:** 5 minutes  
**Approval:** Recommended but not required

---

### **Step 2: Verify Import Works**

**Test:**
1. Open rapporter.html in browser
2. Open browser console
3. Check for import errors
4. Verify page still loads
5. Verify existing functionality works

**Expected Result:** No errors, page works as before

**If Errors:**
- Check import path is correct
- Check file exists at `/core/reportEntryResolver.js`
- Check browser supports ES6 modules

---

## 🔍 NEXT RISKY STEP: REPLACE ONE CHAIN (MEDIUM RISK)

### **Step 3: Replace getEntryCreatedAt (NEEDS APPROVAL)**

**File:** `public/modules/egenkontrol/rapporter.html`

**Current Code (lines 869-892):**
```javascript
function getEntryCreatedAt(e) {
    return (
        e?.createdAt ||
        e?.createdAtClient ||
        // ... 20 more fields
        null
    );
}
```

**Replace With:**
```javascript
function getEntryCreatedAt(e) {
    const result = resolveEntryCreatedTimestamp(e);
    
    // Log warnings for monitoring
    if (result.warnings.length > 0) {
        console.warn('[getEntryCreatedAt] Warnings:', result.warnings, 'Source:', result.source);
    }
    
    return result.timestamp;
}
```

**Why This Approach:**
- ✅ Keeps function signature same (no breaking changes)
- ✅ Adds warning logging (improves monitoring)
- ✅ Uses new resolver internally
- ✅ Easy to rollback (just revert function)

**Risk:** MEDIUM  
**Why Risky:** Changes runtime behavior  
**Duration:** 2-4 hours (including testing)  
**Approval:** REQUIRED

---

### **Step 4: Test Thoroughly**

**Test Cases:**
1. Load rapporter.html
2. Verify all entries display
3. Check timestamps are correct
4. Check console for warnings
5. Compare with previous version
6. Test all report types:
   - Normal entries
   - Entries with dateKey only
   - Entries with nested taskInstance
   - Alert entries
   - Entries with missing timestamps

**Regression Tests:**
- Export still works
- Print still works
- Filtering still works
- Sorting still works
- All entry types display

**If Issues:**
- Revert function to original
- Document issue
- Fix resolver
- Try again

---

## 📋 MIGRATION CHECKLIST

### **Phase 2.1: Import Only (SAFE)**
- [ ] Add import statement
- [ ] Test page loads
- [ ] Verify no console errors
- [ ] Verify existing functionality works
- [ ] Commit changes

### **Phase 2.2: Replace getEntryCreatedAt (NEEDS APPROVAL)**
- [ ] Get approval
- [ ] Replace function
- [ ] Add warning logging
- [ ] Test all entry types
- [ ] Run regression tests
- [ ] Monitor for issues
- [ ] Commit changes

### **Phase 2.3: Replace getEntryHandledAt (NEEDS APPROVAL)**
- [ ] Get approval
- [ ] Replace function
- [ ] Add warning logging
- [ ] Test all entry types
- [ ] Run regression tests
- [ ] Monitor for issues
- [ ] Commit changes

### **Phase 2.4: Replace Alert Functions (NEEDS APPROVAL)**
- [ ] Get approval
- [ ] Replace getAlertCreatedAt
- [ ] Replace getAlertHandledAt
- [ ] Test alert entries
- [ ] Run regression tests
- [ ] Commit changes

### **Phase 2.5: Replace Inline Performer Fallback (NEEDS APPROVAL)**
- [ ] Get approval
- [ ] Replace inline `completedByName || responsibleName`
- [ ] Test performer display
- [ ] Run regression tests
- [ ] Commit changes

### **Phase 2.6: Replace Inline Category Mapping (NEEDS APPROVAL)**
- [ ] Get approval
- [ ] Replace `resolveCategory` function
- [ ] Test category display
- [ ] Run regression tests
- [ ] Commit changes

### **Phase 2.7: Use normalizeReportEntry (OPTIONAL)**
- [ ] Get approval
- [ ] Replace all inline calls with single `normalizeReportEntry()`
- [ ] Simplify rendering code
- [ ] Test all displays
- [ ] Run regression tests
- [ ] Commit changes

---

## ⚠️ ROLLBACK PLAN

### **If Import Fails:**
1. Remove import statement
2. Refresh page
3. Verify works again

### **If Function Replacement Fails:**
1. Revert function to original code
2. Refresh page
3. Verify works again
4. Document issue
5. Fix resolver
6. Try again

### **If Major Issues:**
1. Revert all changes
2. Keep resolver file (foundation still useful)
3. Investigate issues
4. Plan better migration approach

---

## 📊 MONITORING

### **After Each Step:**

**Check Console:**
- No import errors
- No runtime errors
- Warning logs appear (expected)

**Check Display:**
- All entries show
- Timestamps correct
- Performers show
- Categories correct

**Check Functionality:**
- Export works
- Print works
- Filtering works
- Sorting works

**Check Performance:**
- Page loads fast
- No slowdowns
- No memory leaks

---

## 🎯 SUCCESS CRITERIA

### **Phase 2.1 Success:**
- ✅ Import added
- ✅ No errors
- ✅ Page works as before

### **Phase 2.2 Success:**
- ✅ Function replaced
- ✅ Timestamps still correct
- ✅ Warnings logged
- ✅ No regressions

### **Phase 2.3-2.6 Success:**
- ✅ All inline chains replaced
- ✅ All displays correct
- ✅ Warnings logged
- ✅ No regressions

### **Phase 2.7 Success:**
- ✅ Using `normalizeReportEntry()` everywhere
- ✅ Code simplified
- ✅ Stable contract used
- ✅ No regressions

---

## 📈 ESTIMATED TIMELINE

### **Phase 2.1: Import Only**
- Duration: 15 minutes
- Risk: LOW
- Approval: Recommended

### **Phase 2.2: First Function**
- Duration: 2-4 hours
- Risk: MEDIUM
- Approval: REQUIRED

### **Phase 2.3-2.6: Remaining Functions**
- Duration: 1-2 days
- Risk: MEDIUM
- Approval: REQUIRED

### **Phase 2.7: Full Migration**
- Duration: 1 day
- Risk: HIGH
- Approval: REQUIRED

**Total:** 2-3 days for complete migration

---

## 🚫 DO NOT DO

- ❌ Replace all functions at once
- ❌ Skip testing
- ❌ Skip approval
- ❌ Remove old functions before testing
- ❌ Change resolver priority order
- ❌ Modify Firestore schema
- ❌ Change data contracts

---

## ✅ ALWAYS DO

- ✅ Test after each change
- ✅ Monitor console for warnings
- ✅ Compare with previous version
- ✅ Run regression tests
- ✅ Document issues
- ✅ Keep rollback plan ready
- ✅ Get approval for risky changes

---

**Status:** Ready for Phase 2.1 (import only)  
**Next:** Add import statement (LOW RISK)  
**Approval:** Recommended for import, REQUIRED for function replacement
