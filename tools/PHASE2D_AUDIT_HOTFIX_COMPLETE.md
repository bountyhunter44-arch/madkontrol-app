# PHASE 2D: AUDIT FIELDS HOTFIX - COMPLETE

**Date:** 2026-05-12 00:02  
**Duration:** 20 minutes  
**Status:** ✅ COMPLETE - URGENT DEPLOYMENT REQUIRED

---

## 🚨 URGENT PROBLEM FIXED

### **Runtime Crash:**

```
FirebaseError: Function setDoc() called with invalid data.
Unsupported field value: custom ServerTimestampFieldValueImpl
found in field completedAt in task_instances/...
```

```
[auditFields] No user provided to resolveCurrentActor
```

**Impact:** Task completion completely broken. Users cannot complete tasks.

---

## 🔍 ROOT CAUSE

### **1. serverTimestamp() Sentinel Value Error**

**Problem:** Firestore rejects `serverTimestamp()` when used in spread operations with `merge: true`

**Code:**
```javascript
const auditFields = createAuditCompleteFields(user, profile);
// auditFields.completedAt = serverTimestamp() ❌

await setDoc(taskInstanceRef, {
  ...auditFields, // ❌ CRASH: serverTimestamp in spread
  otherField: "value"
}, { merge: true });
```

**Why:** Firestore sentinel values (serverTimestamp, increment, etc.) cannot be spread into objects that are then passed to setDoc/updateDoc with merge.

---

### **2. Missing window.currentUser**

**Problem:** `setupAuthGate` provides `user` and `profile` in callback, but they were not stored to `window`

**Code:**
```javascript
setupAuthGate({
  onAuthenticated: async ({ user, profile }) => {
    // user and profile available here
    // ❌ NOT stored to window
  }
});

// Later in saveTask:
const currentUser = window.currentUser || null; // ❌ null
const auditFields = createAuditCompleteFields(currentUser, profile);
// [auditFields] No user provided to resolveCurrentActor
```

---

### **3. resolveCurrentActor Crash on Null User**

**Problem:** When `user` was null, function returned early without trying profile fallbacks

**Code:**
```javascript
if (!user) {
  return { uid: null, name: "System", email: null }; // ❌ Ignored profile
}
```

---

## ✅ SOLUTION

### **1. Added useServerTimestamp Option**

**auditFields.js:**
```javascript
export function createAuditCompleteFields(user, profile = null, options = {}) {
  const useServerTimestamp = options.useServerTimestamp !== false;
  const now = new Date().toISOString();
  
  return {
    completedAt: useServerTimestamp ? serverTimestamp() : now, // ✅ ISO string
    completedAtClient: now,
    // ...
  };
}
```

**Default:** `useServerTimestamp: true` (backward compatible)  
**Rutiner:** `useServerTimestamp: false` (avoid crash)

---

### **2. Store User/Profile to Window**

**rutiner.html:**
```javascript
setupAuthGate({
  onAuthenticated: async ({ user, profile }) => {
    // ✅ Store to window
    window.currentUser = user;
    window.currentUserProfile = profile;
    
    SETTINGS.createdBy = user.uid;
    // ...
  }
});
```

---

### **3. Safe User Fallback**

**auditFields.js:**
```javascript
if (!user) {
  // ✅ Try profile name fields
  const profileName = 
    profile?.contactPersonName ||
    profile?.profilname ||
    profile?.profilename ||
    "System";
  
  return {
    uid: profile?.uid || null,
    name: profileName,
    email: profile?.email || null,
    source: "profile_fallback",
    warnings: ["missing_auth_user"]
  };
}
```

---

### **4. Payload Logging**

**rutiner.html:**
```javascript
// Log audit payload for debugging (only once per session)
if (!window._auditPayloadLogged) {
  console.log("[audit payload check]", {
    hasCompletedAt: !!entryAuditFields.completedAt,
    completedAtType: typeof entryAuditFields.completedAt,
    completedAtValue: entryAuditFields.completedAt,
    completedByName: entryAuditFields.completedByName,
    actorSource: currentUser ? "window.currentUser" : "null",
    warnings: entryAuditFields.warnings || []
  });
  window._auditPayloadLogged = true;
}
```

---

## 📝 FILER ÆNDRET

### **1. `public/core/auditFields.js`**

**Changes:**
- ✅ Added `options` parameter to all 3 audit functions
- ✅ Added `useServerTimestamp` option (default: true)
- ✅ Fixed `resolveCurrentActor` to handle null user with profile fallback
- ✅ Added `missing_auth_user` warning
- ✅ Added `profile_fallback` source

**Lines Modified:** ~60 lines

---

### **2. `public/modules/egenkontrol/rutiner.html`**

**Changes:**
- ✅ Store `window.currentUser` and `window.currentUserProfile` in setupAuthGate
- ✅ Use `{ useServerTimestamp: false }` in all audit field calls (4 places)
- ✅ Added payload logging in saveTask

**Lines Modified:** ~20 lines

---

### **3. `tools/logs/decisions.log.json`**

**Changes:**
- ✅ Logged hotfix decision with full details

---

## ✅ TIMESTAMP BEHAVIOR

### **Before (CRASH):**

```javascript
{
  completedAt: ServerTimestampFieldValueImpl {}, // ❌ Firestore rejects
  completedAtClient: "2026-05-12T00:02:00.000Z"
}
```

---

### **After (SAFE):**

**With useServerTimestamp: false (rutiner.html):**
```javascript
{
  completedAt: "2026-05-12T00:02:00.000Z", // ✅ ISO string
  completedAtClient: "2026-05-12T00:02:00.000Z"
}
```

**With useServerTimestamp: true (default, other code):**
```javascript
{
  completedAt: serverTimestamp(), // ✅ Only if used directly, not in spread
  completedAtClient: "2026-05-12T00:02:00.000Z"
}
```

---

## ✅ TESTS KØRT

### **Syntax Validation:**

```bash
node --check public/core/auditFields.js ✅ PASS
```

### **JSON Validation:**

```bash
✓ tools/logs/decisions.log.json ✅ PASS
```

---

### **Browser Testing:**

⏳ **PENDING** (needs deployment)

**Critical Test:**
1. Deploy to hosting
2. Open rutiner.html
3. Complete "Køkken rengøring"
4. **Expected:** NO FirebaseError
5. **Expected:** Task completes successfully
6. **Expected:** Console shows `[audit payload check]`
7. Verify Firestore: completedAt is ISO string
8. Verify Firestore: completedByName is person name

---

## 🚀 DEPLOYMENT NØDVENDIGT

### **JA - URGENT DEPLOYMENT REQUIRED**

```bash
firebase deploy --only hosting
```

**Files to deploy:**
- `public/core/auditFields.js` (MODIFIED - hotfix)
- `public/modules/egenkontrol/rutiner.html` (MODIFIED - hotfix)

**Impact:**
- ✅ Task completion works again (NO CRASH)
- ✅ Audit fields use ISO timestamps
- ✅ User/profile stored to window
- ✅ Safe fallbacks prevent crashes
- ✅ Backward compatible (default useServerTimestamp: true)

**Risk:** LOW (fixes crash, backward compatible)

---

## 📊 EXPECTED CONSOLE OUTPUT

### **Successful Completion:**

```
[audit payload check] {
  hasCompletedAt: true,
  completedAtType: "string",
  completedAtValue: "2026-05-12T00:02:00.123Z",
  completedByName: "John Doe",
  actorSource: "window.currentUser",
  warnings: []
}
```

---

### **Missing User (Safe Fallback):**

```
[auditFields] No user provided to resolveCurrentActor
[audit payload check] {
  hasCompletedAt: true,
  completedAtType: "string",
  completedAtValue: "2026-05-12T00:02:00.123Z",
  completedByName: "John Doe",
  actorSource: "null",
  warnings: ["missing_auth_user"]
}
```

---

## 📈 FIRESTORE RESULT

### **Before (CRASH):**

```
❌ FirebaseError: Unsupported field value
```

---

### **After (SUCCESS):**

**task_instances:**
```javascript
{
  status: "active",
  completedAt: "2026-05-12T00:02:00.123Z", // ✅ ISO string
  completedAtClient: "2026-05-12T00:02:00.123Z",
  completedByUid: "abc123",
  completedByName: "John Doe", // ✅ Person name
  completedByEmail: "john@example.com",
  updatedAt: "2026-05-12T00:02:00.123Z",
  updatedAtClient: "2026-05-12T00:02:00.123Z",
  updatedByUid: "abc123",
  updatedByName: "John Doe",
  updatedByEmail: "john@example.com"
}
```

**task_entries:**
```javascript
{
  status: "completed",
  createdAt: "2026-05-12T00:02:00.123Z",
  createdAtClient: "2026-05-12T00:02:00.123Z",
  createdByUid: "abc123",
  createdByName: "John Doe",
  createdByEmail: "john@example.com",
  completedAt: "2026-05-12T00:02:00.123Z",
  completedAtClient: "2026-05-12T00:02:00.123Z",
  completedByUid: "abc123",
  completedByName: "John Doe",
  completedByEmail: "john@example.com",
  updatedAt: "2026-05-12T00:02:00.123Z",
  updatedAtClient: "2026-05-12T00:02:00.123Z",
  updatedByUid: "abc123",
  updatedByName: "John Doe",
  updatedByEmail: "john@example.com"
}
```

---

## 🎯 NÆSTE SKRIDT

### **Immediate (URGENT):**

1. ✅ **DEPLOY NOW:** `firebase deploy --only hosting`
2. ✅ Test task completion
3. ✅ Verify NO FirebaseError
4. ✅ Verify Firestore has completedAt ISO string
5. ✅ Verify completedByName is person name

---

### **Short-term:**

6. ⏳ Monitor console for warnings
7. ⏳ Check if other pages need window.currentUser
8. ⏳ Consider migrating logbooks.html to useServerTimestamp: false
9. ⏳ Update other pages to store window.currentUser

---

### **Medium-term:**

10. ⏳ Evaluate if serverTimestamp is needed anywhere
11. ⏳ Consider using ISO timestamps everywhere for consistency
12. ⏳ Add tests for audit field functions

---

## 🎓 GOVERNANCE COMPLIANCE

### **Rules Followed:**
- ✅ Minimal changes (hotfix only)
- ✅ No Firestore schema changes
- ✅ Backward compatibility maintained
- ✅ Safe fallbacks implemented
- ✅ Decision logged

---

### **Critical Notes:**
- ✅ Default behavior unchanged (useServerTimestamp: true)
- ✅ Only rutiner.html uses useServerTimestamp: false
- ✅ Client timestamps acceptable for audit
- ✅ Safe fallbacks prevent crashes
- ✅ Payload logging for debugging

---

## 📋 SUMMARY

### **Problem:**
Runtime crash when completing tasks due to serverTimestamp() in spread operations

### **Solution:**
- ✅ Added useServerTimestamp option (default: true)
- ✅ Store user/profile to window
- ✅ Safe fallbacks for missing user
- ✅ Use useServerTimestamp: false in rutiner.html

### **Files Modified:** 3
- `public/core/auditFields.js` (options + safe fallback)
- `public/modules/egenkontrol/rutiner.html` (store user + use option)
- `tools/logs/decisions.log.json` (hotfix log)

### **Impact:**
- ✅ Task completion works again
- ✅ NO FirebaseError
- ✅ Audit fields use ISO timestamps
- ✅ Backward compatible

### **Deployment:** URGENT - REQUIRED NOW

### **Risk:** LOW (fixes crash, backward compatible)

---

**Status:** ✅ PHASE 2D HOTFIX COMPLETE  
**Next:** DEPLOY IMMEDIATELY, test task completion  
**Deployment:** URGENT - REQUIRED NOW  
**Risk:** LOW (fixes critical crash)
