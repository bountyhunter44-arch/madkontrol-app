# PHASE 2: AUDIT CONTRACT - WRITE PATHS ANALYSIS

**Date:** 2026-05-11  
**Status:** ANALYSIS COMPLETE - PARTIAL IMPLEMENTATION  
**Implemented:** Logbooks only  
**Pending:** All other write paths

---

## ✅ IMPLEMENTED WRITE PATHS

### **1. Logbook Entries (COMPLETE)**

**Collection:** `logbook_entries`  
**File:** `public/modules/egenkontrol/logbooks.html`  
**Function:** `buildEntryFromForm`  
**Line:** 1778

**Audit Fields Added:**
- ✅ `createdAt` (serverTimestamp)
- ✅ `createdAtClient` (ISO string)
- ✅ `createdByUid` (user.uid)
- ✅ `createdByName` (resolved from profile)
- ✅ `createdByEmail` (user.email)
- ✅ `completedAt` (serverTimestamp - immediate)
- ✅ `completedAtClient` (ISO string - immediate)
- ✅ `completedByUid` (user.uid)
- ✅ `completedByName` (resolved from profile)
- ✅ `completedByEmail` (user.email)
- ✅ `updatedAt` (serverTimestamp)
- ✅ `updatedAtClient` (ISO string)
- ✅ `updatedByUid` (user.uid)
- ✅ `updatedByName` (resolved from profile)
- ✅ `updatedByEmail` (user.email)

**Status:** ✅ COMPLETE  
**Risk:** LOW (new entries only, no migration needed)  
**Testing:** Needs browser testing

---

## ⏳ PENDING WRITE PATHS

### **2. Task Instances Completion (HIGH PRIORITY)**

**Collection:** `task_instances`  
**File:** `public/modules/egenkontrol/rutiner.html`  
**Functions:** Multiple completion handlers  
**Lines:** 2551, 2781, 2815, 2850, 4017

**Current Audit Fields:**
- ⚠️ `updatedAt` (serverTimestamp) - EXISTS
- ❌ `completedAt` - MISSING
- ❌ `completedBy*` - MISSING
- ❌ `createdBy*` - MISSING (instances created by backend)

**Needed:**
- Add `createAuditCompleteFields()` when marking complete
- Preserve existing `updatedAt`
- Add `completedAt`, `completedBy*` fields

**Risk:** MEDIUM (affects task completion tracking)  
**Priority:** HIGH

---

### **3. Task Templates Update (MEDIUM PRIORITY)**

**Collection:** `task_templates`  
**File:** `public/modules/egenkontrol/rutiner.html`  
**Functions:** Frequency update, template modification  
**Lines:** 3068, 4046

**Current Audit Fields:**
- ⚠️ `updatedAt` (serverTimestamp) - EXISTS
- ❌ `updatedBy*` - MISSING

**Needed:**
- Add `createAuditUpdateFields()` when updating templates
- Preserve existing fields

**Risk:** LOW (templates rarely updated)  
**Priority:** MEDIUM

---

### **4. Cooling Process (HIGH PRIORITY)**

**Collection:** `task_instances`  
**File:** `public/modules/egenkontrol/rutiner-cooling-ui.js`  
**Function:** Cooling start  
**Line:** 267

**Current Audit Fields:**
- ⚠️ `updatedAt` - IMPLIED (via updateDoc)
- ❌ `completedAt` - MISSING (when cooling finishes)
- ❌ `completedBy*` - MISSING

**Needed:**
- Add `createAuditCompleteFields()` when cooling finishes
- Track who started and who finished cooling

**Risk:** HIGH (HACCP compliance)  
**Priority:** HIGH

---

### **5. Inventory Transactions (MEDIUM PRIORITY)**

**Collection:** `inventory_items`, `inventory_transactions`  
**File:** `public/modules/lager/scanner.html`  
**Functions:** Add item, remove item, adjust batch  
**Lines:** 267, 286, 316, 377, 386, 516, 523

**Current Audit Fields:**
- ⚠️ `updatedAt` (serverTimestamp) - EXISTS on items
- ⚠️ `createdAt` (serverTimestamp) - EXISTS on transactions
- ❌ `createdBy*` - MISSING
- ❌ `updatedBy*` - MISSING

**Needed:**
- Add full audit contract to transactions
- Add `updatedBy*` to item updates

**Risk:** MEDIUM (inventory tracking)  
**Priority:** MEDIUM

---

### **6. Onboarding Answers (LOW PRIORITY)**

**Collection:** `onboarding_answers`  
**Files:** `public/onboarding.html`, `public/modules/egenkontrol/onboarding.html`  
**Function:** Save onboarding  
**Lines:** 2756, 2767

**Current Audit Fields:**
- ⚠️ `createdAt` (serverTimestamp) - EXISTS
- ⚠️ `createdByName` - EXISTS
- ❌ `createdByUid` - MISSING
- ❌ `createdByEmail` - MISSING
- ❌ `updatedAt` - MISSING
- ❌ `updatedBy*` - MISSING

**Needed:**
- Add full audit contract
- Track updates to onboarding

**Risk:** LOW (onboarding rarely updated)  
**Priority:** LOW

---

### **7. Risk Analysis (MEDIUM PRIORITY)**

**Collection:** `haccp_snapshots`, `risk_custom_cards`, `risk_notes`  
**File:** `public/modules/egenkontrol/risikoanalyse.html`, `riskAnalysisService.js`  
**Functions:** Save risk note, save custom card, save snapshot  
**Lines:** 1252, 1281, 1167, 1188, 1286, 1516

**Current Audit Fields:**
- ⚠️ `createdAt` (serverTimestamp) - EXISTS on snapshots
- ⚠️ `updatedAt` (serverTimestamp) - EXISTS on snapshots
- ⚠️ `createdByUid` - EXISTS on custom cards
- ❌ `createdByName` - MISSING
- ❌ `updatedBy*` - MISSING

**Needed:**
- Add full audit contract to all risk documents
- Track who created/updated risk analysis

**Risk:** MEDIUM (compliance documentation)  
**Priority:** MEDIUM

---

## 📊 SUMMARY

### **Collections Analyzed: 7**

1. ✅ `logbook_entries` - IMPLEMENTED
2. ⏳ `task_instances` - PENDING (HIGH PRIORITY)
3. ⏳ `task_templates` - PENDING (MEDIUM PRIORITY)
4. ⏳ `inventory_items` - PENDING (MEDIUM PRIORITY)
5. ⏳ `inventory_transactions` - PENDING (MEDIUM PRIORITY)
6. ⏳ `onboarding_answers` - PENDING (LOW PRIORITY)
7. ⏳ `haccp_snapshots` - PENDING (MEDIUM PRIORITY)

### **Write Operations Found: 20+**

- ✅ Implemented: 1 (logbooks)
- ⏳ Pending: 19+

### **Priority Breakdown:**

- **HIGH:** 2 (task completion, cooling)
- **MEDIUM:** 4 (templates, inventory, risk analysis)
- **LOW:** 1 (onboarding)

---

## 🎯 RECOMMENDED IMPLEMENTATION ORDER

### **Phase 1: COMPLETE ✅**
1. ✅ Logbooks (buildEntryFromForm)

### **Phase 2: HIGH PRIORITY**
2. ⏳ Task instances completion (rutiner.html)
3. ⏳ Cooling process completion (rutiner-cooling-ui.js)

### **Phase 3: MEDIUM PRIORITY**
4. ⏳ Task templates update (rutiner.html)
5. ⏳ Inventory transactions (scanner.html)
6. ⏳ Risk analysis (risikoanalyse.html, riskAnalysisService.js)

### **Phase 4: LOW PRIORITY**
7. ⏳ Onboarding answers (onboarding.html)

---

## ⚠️ CRITICAL NOTES

### **Backend Writes:**

**NOT ANALYZED YET:**
- `functions/` directory contains backend writes
- Backend creates `task_instances` via `startDayForLocation`
- Backend may create other documents

**Action Required:**
- Analyze `functions/index.js`
- Find all backend Firestore writes
- Add audit contract to backend functions

### **Security Rules:**

**NOT ANALYZED:**
- Firestore security rules may need updates
- Ensure audit fields are not user-writable
- Ensure `createdAt` cannot be overwritten

**Action Required:**
- Review `firestore.rules`
- Add validation for audit fields
- Prevent tampering

---

## 📋 IMPLEMENTATION CHECKLIST

### **For Each Write Path:**

- [ ] Identify collection and operation (create/update/complete)
- [ ] Choose correct audit helper:
  - `createAuditCreateFields()` for new documents
  - `createAuditUpdateFields()` for updates
  - `createAuditCompleteFields()` for completions
- [ ] Import helper at top of file
- [ ] Get `currentUser` and `currentUserProfile`
- [ ] Spread audit fields into document
- [ ] Test in browser
- [ ] Verify fields in Firestore
- [ ] Update documentation

---

## 🚫 DO NOT

- ❌ Remove existing timestamp fields
- ❌ Overwrite `createdAt` on updates
- ❌ Change Firestore collection names
- ❌ Migrate old data yet
- ❌ Break existing functionality

---

## ✅ ALWAYS

- ✅ Use central audit helpers
- ✅ Preserve backward compatibility
- ✅ Test after each change
- ✅ Verify in Firestore console
- ✅ Update documentation
- ✅ Log decision

---

**Status:** 1/7 collections implemented  
**Next:** Task instances completion (HIGH PRIORITY)  
**Deployment:** Needed for logbooks (hosting deploy)
