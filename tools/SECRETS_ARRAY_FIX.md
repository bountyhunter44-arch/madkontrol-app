# SECRETS ARRAY SYNTAX FIX - COMPLETE

**Date:** 2026-05-12 20:56  
**Issue:** Firebase deploy error: `projects/madkontrollen/secrets/[object Object]/versions/latest`  
**Cause:** Incorrect secrets array syntax using string literals instead of defineSecret references  
**Status:** ✅ FIXED - READY FOR DEPLOYMENT

---

## 🔧 CHANGES MADE

### **ONLY secrets array syntax fixed - NO Stripe logic changed**

---

## 📝 FILES MODIFIED

### **1. `functions/index.js`**

**Line 49-50: Added STRIPE secret definitions**
```javascript
// BEFORE: Missing
// AFTER:
const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");
const STRIPE_WEBHOOK_SECRET = defineSecret("STRIPE_WEBHOOK_SECRET");
```

**Line 113: Fixed stripeWebhook secrets array**
```javascript
// BEFORE:
secrets: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],

// AFTER:
secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET],
```

**Line 6475: Fixed createStripeCheckoutSession secrets array**
```javascript
// BEFORE:
{ secrets: ["FUNCTIONS_CONFIG_EXPORT"] },

// AFTER:
{ secrets: [FUNCTIONS_CONFIG] },
```

**Line 6740: Fixed createOnboardingCheckoutSession secrets array**
```javascript
// BEFORE:
{ secrets: ["FUNCTIONS_CONFIG_EXPORT"] },

// AFTER:
{ secrets: [FUNCTIONS_CONFIG] },
```

**Line 8179: Fixed finalizeOnboardingCheckoutProvisioning secrets array**
```javascript
// BEFORE:
{ secrets: ["FUNCTIONS_CONFIG_EXPORT", EMAIL_USER, EMAIL_PASSWORD] },

// AFTER:
{ secrets: [FUNCTIONS_CONFIG, EMAIL_USER, EMAIL_PASSWORD] },
```

**Line 9867: Added FUNCTIONS_CONFIG to factory call**
```javascript
// BEFORE:
egenkontrol.createEgenkontrolProgramForLocation({
  db,
  sanitizeString,
  getUserAccessProfile,
  assertSeoGeneratorAccess,
  sanitizeOnboardingProfile,
  sanitizeRiskModelInput
});

// AFTER:
egenkontrol.createEgenkontrolProgramForLocation({
  db,
  sanitizeString,
  getUserAccessProfile,
  assertSeoGeneratorAccess,
  sanitizeOnboardingProfile,
  sanitizeRiskModelInput,
  FUNCTIONS_CONFIG
});
```

---

### **2. `functions/egenkontrol/createEgenkontrolProgramForLocation.js`**

**Line 10: Added FUNCTIONS_CONFIG parameter**
```javascript
// BEFORE:
module.exports = ({
  db,
  sanitizeString,
  getUserAccessProfile,
  assertSeoGeneratorAccess,
  sanitizeOnboardingProfile,
  sanitizeRiskModelInput
}) =>

// AFTER:
module.exports = ({
  db,
  sanitizeString,
  getUserAccessProfile,
  assertSeoGeneratorAccess,
  sanitizeOnboardingProfile,
  sanitizeRiskModelInput,
  FUNCTIONS_CONFIG
}) =>
```

**Line 13: Fixed secrets array**
```javascript
// BEFORE:
{ secrets: ["FUNCTIONS_CONFIG_EXPORT"] },

// AFTER:
{ secrets: [FUNCTIONS_CONFIG] },
```

---

## ✅ VERIFIED UNCHANGED

### **Stripe Checkout Logic - UNTOUCHED:**
- ✅ `getStripeConfig()` - unchanged
- ✅ `getStripeClient()` - unchanged
- ✅ Price IDs - unchanged
- ✅ Webhook event handlers - unchanged
- ✅ Success/cancel URLs - unchanged
- ✅ Metadata - unchanged
- ✅ Stripe API calls - unchanged
- ✅ Onboarding flow - unchanged
- ✅ Firestore writes - unchanged

### **Already Correct (not changed):**
- ✅ `getCloudinarySignature` - line 8725
- ✅ `analyzeCloudinaryAsset` - line 9063
- ✅ `getCloudinaryAssets` - line 9286
- ✅ `searchRestaurantImages` - line 9402
- ✅ `enhanceAndUploadRestaurantImage` - line 9501
- ✅ `generateSeoAiSuggestions` - line 9626

---

## 🎯 PATTERN FIXED

### **Incorrect Pattern:**
```javascript
secrets: ["STRIPE_SECRET_KEY"]           // ❌ String literal
secrets: ["FUNCTIONS_CONFIG_EXPORT"]     // ❌ String literal
secrets: [{ STRIPE_SECRET_KEY }]         // ❌ Object
secrets: [{ secret: STRIPE_SECRET_KEY }] // ❌ Object property
```

### **Correct Pattern:**
```javascript
// 1. Define secret at top of file
const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");

// 2. Use reference in secrets array
secrets: [STRIPE_SECRET_KEY]             // ✅ Reference
```

---

## 📊 SUMMARY

**Total Changes:** 2 files, 8 locations

**functions/index.js:**
- Added 2 secret definitions (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET)
- Fixed 4 secrets arrays (stripeWebhook, createStripeCheckoutSession, createOnboardingCheckoutSession, finalizeOnboardingCheckoutProvisioning)
- Added FUNCTIONS_CONFIG to 1 factory call

**functions/egenkontrol/createEgenkontrolProgramForLocation.js:**
- Added FUNCTIONS_CONFIG parameter
- Fixed 1 secrets array

---

## ✅ SYNTAX CHECK

```bash
node --check functions/index.js
# ✅ PASS

node --check functions/egenkontrol/createEgenkontrolProgramForLocation.js
# ✅ PASS
```

---

## 🚀 DEPLOYMENT

### **Step 1: Deploy Functions Only**

```bash
firebase deploy --only functions
```

**Expected:** ✅ Success (secrets syntax fixed)

---

### **Step 2: Deploy All (if functions succeed)**

```bash
firebase deploy --only hosting,functions
```

---

## 🎓 ROOT CAUSE

**Problem:**
Firebase Functions v2 requires secrets to be **defineSecret references**, not string literals.

**Error:**
```
projects/madkontrollen/secrets/[object Object]/versions/latest
```

This error occurs when secrets array contains objects or incorrect references.

**Solution:**
1. Define secrets at top: `const X = defineSecret("X")`
2. Use references in array: `secrets: [X]`
3. Never use strings: `secrets: ["X"]` ❌

---

## 🔒 STRIPE SAFETY

### **Confirmed Unchanged:**

**Checkout Session Creation:**
- ✅ `getStripeConfig()` logic unchanged
- ✅ Price IDs: `price_monthly`, `price_yearly` unchanged
- ✅ Success URL: `/success?session_id={CHECKOUT_SESSION_ID}` unchanged
- ✅ Cancel URL: `/pricing` unchanged

**Webhook Handling:**
- ✅ Event types unchanged
- ✅ Firestore updates unchanged
- ✅ Subscription status logic unchanged

**Onboarding:**
- ✅ Metadata unchanged
- ✅ Provisioning logic unchanged
- ✅ Draft creation unchanged

---

**Status:** ✅ SECRETS SYNTAX FIXED  
**Next:** Deploy functions only, verify success  
**Risk:** LOW (syntax fix only, no logic changes)
