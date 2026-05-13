/**
 * Environment Guard - Backend Security
 * Prevents dangerous operations in production
 * 
 * PRODUCTION-GRADE IMPLEMENTATION:
 * - Single source of truth for production detection (projectId)
 * - Custom claims only for developer verification (no email checks)
 * - No bypass methods
 * - Clear operation categorization
 */

const functions = require("firebase-functions");

/**
 * Detect environment from Firebase project ID
 * SINGLE SOURCE OF TRUTH: Only 'madkontrollen' is production
 */
function getEnvironment() {
  const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
  
  // CRITICAL: Single production project ID
  const isProduction = projectId === 'madkontrollen';
  const isDevelopment = !isProduction;
  
  return {
    isProduction,
    isDevelopment,
    projectId
  };
}

/**
 * Check if user has developer/superadmin custom claims
 * ONLY uses Firebase custom claims - no email or userData checks
 */
function isDeveloperUser(auth) {
  if (!auth || !auth.uid || !auth.token) {
    return false;
  }
  
  // ONLY check custom claims set via Firebase Admin SDK
  return auth.token.isDeveloper === true || auth.token.isSuperAdmin === true;
}

/**
 * Operation categories for security control
 */
const OperationCategory = {
  DANGEROUS: 'dangerous',    // Always blocked in production (seed, reset, archive)
  RESTRICTED: 'restricted',  // Blocked for demo/test accounts in production
  NORMAL: 'normal'          // Allowed for all authenticated users
};

/**
 * Guard against dangerous operations
 * Throws error if operation is not allowed
 * 
 * CRITICAL: NO BYPASS POSSIBLE
 * - Production = always blocked
 * - Development = requires custom claims only
 */
function guardDangerousOperation(context, operationName) {
  const env = getEnvironment();
  
  // CRITICAL: ALWAYS block dangerous operations in production
  // NO EXCEPTIONS - not even for developers
  if (env.isProduction) {
    console.error(`BLOCKED: ${operationName} attempted in PRODUCTION`);
    console.error(`  Project: ${env.projectId}`);
    console.error(`  User: ${context.auth?.uid || 'unknown'}`);
    console.error(`  Email: ${context.auth?.token?.email || 'unknown'}`);
    
    throw new functions.https.HttpsError(
      'permission-denied',
      `Operation "${operationName}" is not allowed in production environment. This action has been logged.`
    );
  }
  
  // In development, require developer custom claims
  if (env.isDevelopment) {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Authentication required for dangerous operations'
      );
    }
    
    const isDev = isDeveloperUser(context.auth);
    
    if (!isDev) {
      console.warn(`BLOCKED: ${operationName} attempted by non-developer in development`);
      console.warn(`  User: ${context.auth.uid}`);
      console.warn(`  Email: ${context.auth.token?.email || 'unknown'}`);
      console.warn(`  isDeveloper claim: ${context.auth.token?.isDeveloper || false}`);
      console.warn(`  isSuperAdmin claim: ${context.auth.token?.isSuperAdmin || false}`);
      
      throw new functions.https.HttpsError(
        'permission-denied',
        `Operation "${operationName}" requires developer custom claims (isDeveloper or isSuperAdmin)`
      );
    }
    
    // Log allowed operation in development
    console.warn(`ALLOWED: ${operationName} in development by developer`);
    console.warn(`  User: ${context.auth.uid}`);
    console.warn(`  Email: ${context.auth.token?.email || 'unknown'}`);
  }
}

module.exports = {
  getEnvironment,
  isDeveloperUser,
  guardDangerousOperation,
  OperationCategory
};
