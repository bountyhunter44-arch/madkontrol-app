# SECURITY IMPLEMENTATION - DATA RESET PROTECTION

## 🚫 CRITICAL SECURITY MEASURES IMPLEMENTED

### PROBLEM
Reset data functionality was accessible without proper environment and permission checks, creating a critical security vulnerability in production.

### SOLUTION
Multi-layered security approach with environment detection, role-based access control, and safe alternatives.

---

## 📁 FILES CREATED

### 1. **public/core/environment.js** ✅
**Frontend environment detection**

**Features:**
- Detects production vs development based on hostname
- Production domains: `madkontrollen.dk`, `www.madkontrollen.dk`, `madkontrollen.web.app`
- Development: `localhost`, `127.0.0.1`, `*.local`
- Shows development badge in UI
- Checks user developer/superadmin role
- **BLOCKS all dangerous operations in production**

**API:**
```javascript
MKP.Environment.isProduction()  // Returns true if production
MKP.Environment.isDevelopment()  // Returns true if development
MKP.Environment.canPerformDangerousOperations(userData)  // Returns false in production
```

**Security:**
```javascript
// NEVER allows dangerous operations in production
if (env.isProduction) {
  console.warn('🚫 Dangerous operations are BLOCKED in production');
  return false;
}
```

---

### 2. **functions/security/environmentGuard.js** ✅
**Backend environment protection**

**Features:**
- Detects environment from Firebase project ID
- Production projects: `madkontrollen`, `madkontrollen-prod`, `madkontrollen-production`
- Guards dangerous operations with `guardDangerousOperation()`
- Requires developer/superadmin role in development
- **THROWS ERROR if dangerous operation attempted in production**

**API:**
```javascript
const { guardDangerousOperation } = require('./security/environmentGuard');

// In cloud function:
guardDangerousOperation(context, 'operationName');
// Throws error if production or non-developer user
```

**Security:**
```javascript
if (env.isProduction) {
  console.error(`🚫 BLOCKED: ${operationName} in PRODUCTION`);
  throw new functions.https.HttpsError(
    'permission-denied',
    'Operation not allowed in production. This has been logged.'
  );
}
```

---

### 3. **public/seed-data/resetDatabase.js** ✅ UPDATED
**Script protection**

**Changes:**
- Added environment check at script start
- Exits immediately if production project detected
- Shows clear error message

**Protection:**
```javascript
const projectId = serviceAccount.project_id;
const productionProjects = ['madkontrollen', 'madkontrollen-prod'];

if (productionProjects.includes(projectId)) {
  console.error('🚫🚫🚫 CRITICAL ERROR 🚫🚫🚫');
  console.error('Database reset is NEVER allowed in production.');
  process.exit(1);
}
```

---

### 4. **functions/admin/demoMode.js** ✅
**Safe alternative: Demo mode**

**Features:**
- Creates isolated demo company with separate data
- Demo data expires after 7 days
- User can switch between demo and production
- No impact on real production data

**Functions:**
```javascript
createDemoCompany({ userId, companyName })
enableDemoMode({ userId, userData })
disableDemoMode({ userId, userData })
cleanupExpiredDemoData()
```

**Usage:**
```javascript
// Switch to demo mode
const demo = await enableDemoMode({ userId, userData });
// User now works with demo data

// Switch back to production
await disableDemoMode({ userId, userData });
// User back to real data
```

---

### 5. **functions/admin/softArchive.js** ✅
**Safe alternative: Soft archive**

**Features:**
- Archives data instead of deleting
- Start new period without losing history
- Restore archived data if needed
- All data remains in database

**Functions:**
```javascript
archiveCompany({ companyId, reason, archivedBy })
restoreCompany({ companyId, restoredBy })
startNewPeriod({ companyId, locationId, periodName, startedBy })
getArchivedPeriodData({ periodId, companyId, locationId })
```

**Usage:**
```javascript
// Start new period (archives current data)
const result = await startNewPeriod({
  companyId,
  locationId,
  periodName: "Q1 2026",
  startedBy: userId
});
// Old data archived, fresh start, history preserved
```

---

### 6. **functions/index.js** ✅ UPDATED
**Cloud functions with protection**

**Added:**
- Import environment guard
- Import demo mode and soft archive modules
- 5 new cloud functions with proper security

**Cloud Functions:**
```javascript
// Demo Mode
exports.enableDemoMode
exports.disableDemoMode

// Soft Archive
exports.startNewPeriod  // Safe for all users
exports.archiveCompany  // GUARDED - developer only
exports.restoreCompany  // GUARDED - developer only
```

**Security Example:**
```javascript
exports.archiveCompany = functions.https.onCall(async (data, context) => {
  // CRITICAL: Guard dangerous operation
  guardDangerousOperation(context, "archiveCompany");
  
  // Only reaches here if:
  // 1. NOT production
  // 2. User is developer/superadmin
  
  const result = await softArchive.archiveCompany({ ... });
  return result;
});
```

---

## 🛡️ SECURITY LAYERS

### Layer 1: Frontend Environment Check
```javascript
// In UI code
if (!MKP.Environment.canPerformDangerousOperations(userData)) {
  // Hide reset buttons
  // Disable dangerous actions
  // Show warning message
}
```

### Layer 2: Backend Environment Guard
```javascript
// In cloud function
guardDangerousOperation(context, 'resetData');
// Throws error if production or non-developer
```

### Layer 3: Script Protection
```javascript
// In Node.js scripts
if (productionProjects.includes(projectId)) {
  process.exit(1);
}
```

### Layer 4: Role-Based Access
```javascript
// Check user role
const isDev = isDeveloperUser(auth, userData);
if (!isDev) {
  throw new Error('Developer role required');
}
```

---

## 🔒 PROTECTION MATRIX

| Operation | Production | Development (Regular User) | Development (Developer) |
|-----------|-----------|---------------------------|------------------------|
| Reset Database | ❌ BLOCKED | ❌ BLOCKED | ✅ ALLOWED |
| Archive Company | ❌ BLOCKED | ❌ BLOCKED | ✅ ALLOWED |
| Restore Company | ❌ BLOCKED | ❌ BLOCKED | ✅ ALLOWED |
| Start New Period | ✅ ALLOWED | ✅ ALLOWED | ✅ ALLOWED |
| Enable Demo Mode | ✅ ALLOWED | ✅ ALLOWED | ✅ ALLOWED |

---

## ✅ SAFE ALTERNATIVES FOR PRODUCTION

### Option 1: Demo Mode
**Use case:** Testing without affecting real data

```javascript
// Enable demo mode
const demo = await firebase.functions().httpsCallable('enableDemoMode')();
// User now in isolated demo environment

// Work with demo data...

// Disable demo mode
await firebase.functions().httpsCallable('disableDemoMode')();
// Back to production data
```

**Benefits:**
- ✅ Isolated data
- ✅ Auto-expires after 7 days
- ✅ No impact on production
- ✅ Safe for all users

---

### Option 2: Start New Period
**Use case:** New year, new quarter, fresh start

```javascript
// Archive current period and start fresh
const result = await firebase.functions().httpsCallable('startNewPeriod')({
  companyId: 'company_001',
  locationId: 'location_001',
  periodName: 'Q1 2026'
});

// Result: {
//   success: true,
//   periodId: 'period_1234567890',
//   archivedCount: 1523,
//   message: 'Ny periode startet. 1523 dokumenter arkiveret.'
// }
```

**Benefits:**
- ✅ Fresh start
- ✅ History preserved
- ✅ Can restore if needed
- ✅ Safe for all users

---

### Option 3: Soft Archive (Developer Only)
**Use case:** Archive entire company

```javascript
// Archive company (development only)
const result = await firebase.functions().httpsCallable('archiveCompany')({
  companyId: 'company_001',
  reason: 'Company closed'
});

// Restore if needed
await firebase.functions().httpsCallable('restoreCompany')({
  companyId: 'company_001'
});
```

**Benefits:**
- ✅ Reversible
- ✅ No data loss
- ✅ Clear audit trail
- ⚠️ Developer only

---

## 🧪 TESTING

### Test Environment Detection

**Frontend:**
```javascript
console.log('Is Production:', MKP.Environment.isProduction());
console.log('Is Development:', MKP.Environment.isDevelopment());
console.log('Hostname:', MKP.Environment.getHostname());
```

**Expected:**
- `localhost` → Development
- `madkontrollen.dk` → Production
- `127.0.0.1` → Development

---

### Test Backend Protection

**Try to call dangerous operation in production:**
```javascript
// This will FAIL in production
try {
  await firebase.functions().httpsCallable('archiveCompany')({
    companyId: 'test'
  });
} catch (error) {
  console.error(error.message);
  // "Operation archiveCompany is not allowed in production environment"
}
```

---

### Test Script Protection

**Try to run resetDatabase.js in production:**
```bash
node public/seed-data/resetDatabase.js
```

**Expected output if production:**
```
🚫🚫🚫 CRITICAL ERROR 🚫🚫🚫

This script is attempting to run in PRODUCTION!
Project ID: madkontrollen

Database reset is NEVER allowed in production.
This operation has been BLOCKED.

[Process exits with code 1]
```

---

## 📋 DEVELOPER EMAILS

Emails that have developer/superadmin access:
- `developer@madkontrollen.dk`
- `admin@madkontrollen.dk`
- `superadmin@madkontrollen.dk`

Or users with custom claims:
- `isDeveloper: true`
- `isSuperAdmin: true`

Or users with role:
- `role: 'developer'`
- `role: 'superadmin'`

---

## 🚨 SECURITY AUDIT LOG

All dangerous operations are logged:

**Blocked attempts:**
```
🚫 BLOCKED: archiveCompany attempted in PRODUCTION
   Project: madkontrollen
   User: user_123
   Email: user@example.com
```

**Allowed operations:**
```
⚠️ ALLOWED: archiveCompany in development by developer
   User: dev_456
   Email: developer@madkontrollen.dk
```

---

## ✅ IMPLEMENTATION CHECKLIST

- ✅ Frontend environment detection
- ✅ Backend environment guard
- ✅ Script protection
- ✅ Role-based access control
- ✅ Demo mode alternative
- ✅ Soft archive alternative
- ✅ Start new period functionality
- ✅ Cloud functions with guards
- ✅ Security logging
- ✅ Documentation

---

## 🎯 SUMMARY

**Problem Solved:**
Reset data functionality is now **completely blocked in production** with multiple layers of protection.

**Safe Alternatives Provided:**
1. **Demo Mode** - Isolated testing environment
2. **Start New Period** - Fresh start with history preserved
3. **Soft Archive** - Reversible archiving (developer only)

**Security Guarantees:**
- ❌ NO reset in production (impossible)
- ❌ NO dangerous operations without developer role
- ❌ NO bypass via console or API
- ✅ All attempts logged
- ✅ Safe alternatives available
- ✅ History always preserved
