/**
 * AUDIT FIELDS - CENTRAL AUDIT CONTRACT
 * 
 * Purpose: Single source of truth for audit field creation and resolution
 * Ensures all Firestore writes have consistent audit trail
 * 
 * CRITICAL: All future writes to Firestore MUST use these helpers
 * DO NOT create audit fields manually - use these functions
 * 
 * Created: 2026-05-11
 * Phase: 2 - Audit Contract Standardization
 */

import { serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

/**
 * Resolve current actor (user performing action)
 * 
 * CRITICAL: Must return PERSON name, NOT company name
 * 
 * @param {Object} user - Firebase Auth user object
 * @param {Object|null} profile - User profile from live_user_profiles
 * @returns {Object} - { uid, name, email, warnings }
 */
export function resolveCurrentActor(user, profile = null) {
    if (!user) {
        console.warn("[auditFields] No user provided to resolveCurrentActor");
        
        // Try to get name from profile if user is missing
        const profileName = 
            profile?.contactPersonName ||
            profile?.profile?.contactPersonName ||
            profile?.profilname ||
            profile?.profile?.profilname ||
            profile?.profilename ||
            profile?.profile?.profilename ||
            "System";
        
        return {
            uid: profile?.uid || null,
            name: profileName,
            email: profile?.email || profile?.profile?.accountEmail || null,
            source: "profile_fallback",
            warnings: ["missing_auth_user"]
        };
    }
    
    const warnings = [];
    
    // Priority order for PERSON name resolution:
    // 1. profile.contactPersonName (explicit person name)
    // 2. profile.profile?.contactPersonName (nested)
    // 3. profile.profilname (NEW - person name field)
    // 4. profile.profile?.profilname (nested)
    // 5. profile.profilename (legacy spelling)
    // 6. profile.profile?.profilename (nested legacy)
    // 7. user.displayName (if not company-like)
    // 8. user.email (fallback)
    // 9. "Ukendt bruger" (last resort)
    
    // Get company name for comparison (to avoid using it as person name)
    const companyName = String(
        profile?.companyName || 
        profile?.profile?.companyName || 
        profile?.profileCompanyName ||
        profile?.profile?.profileCompanyName ||
        profile?.name ||
        ""
    ).trim().toLowerCase();
    
    let name = "";
    let source = "";
    
    // Try person name fields in priority order
    if (profile?.contactPersonName) {
        name = String(profile.contactPersonName).trim();
        source = "profile.contactPersonName";
    } else if (profile?.profile?.contactPersonName) {
        name = String(profile.profile.contactPersonName).trim();
        source = "profile.profile.contactPersonName";
    } else if (profile?.profilname) {
        name = String(profile.profilname).trim();
        source = "profile.profilname";
    } else if (profile?.profile?.profilname) {
        name = String(profile.profile.profilname).trim();
        source = "profile.profile.profilname";
    } else if (profile?.profilename) {
        name = String(profile.profilename).trim();
        source = "profile.profilename";
    } else if (profile?.profile?.profilename) {
        name = String(profile.profile.profilename).trim();
        source = "profile.profile.profilename";
    } else if (user.displayName) {
        const displayName = String(user.displayName).trim();
        const displayNameLower = displayName.toLowerCase();
        
        // Check if displayName is actually a company name
        if (companyName && displayNameLower === companyName) {
            warnings.push("actor_field_matches_company_name");
            // Skip displayName, try email instead
            if (user.email) {
                name = String(user.email).trim();
                source = "user.email (displayName was company name)";
            } else {
                name = "Ukendt bruger";
                source = "fallback (displayName was company name)";
                warnings.push("missing_real_person_name");
            }
        } else {
            name = displayName;
            source = "user.displayName";
        }
    } else if (user.email) {
        name = String(user.email).trim();
        source = "user.email";
        warnings.push("missing_real_person_name");
    } else {
        name = "Ukendt bruger";
        source = "fallback";
        warnings.push("missing_real_person_name");
    }
    
    // Final validation: ensure we didn't accidentally use company name
    if (companyName && name.toLowerCase() === companyName) {
        console.warn("[auditFields] Resolved name matches company name, using fallback", {
            resolvedName: name,
            companyName,
            source
        });
        warnings.push("actor_field_matches_company_name");
        name = user.email || "Ukendt bruger";
        source = "fallback (matched company name)";
    }
    
    return {
        uid: user.uid,
        name: name || "Ukendt bruger",
        email: user.email || profile?.profile?.accountEmail || null,
        source,
        warnings
    };
}

/**
 * Create audit fields for document creation
 * Use when creating NEW documents in Firestore
 * 
 * @param {Object} user - Firebase Auth user object
 * @param {Object|null} profile - User profile from live_user_profiles
 * @param {Object} options - { useServerTimestamp: true }
 * @returns {Object} - Audit fields for creation
 */
export function createAuditCreateFields(user, profile = null, options = {}) {
    const actor = resolveCurrentActor(user, profile);
    const useServerTimestamp = options.useServerTimestamp !== false;
    const now = new Date().toISOString();
    
    return {
        createdAt: useServerTimestamp ? serverTimestamp() : now,
        createdAtClient: now,
        createdByUid: actor.uid,
        createdByName: actor.name,
        createdByEmail: actor.email,
        
        updatedAt: useServerTimestamp ? serverTimestamp() : now,
        updatedAtClient: now,
        updatedByUid: actor.uid,
        updatedByName: actor.name,
        updatedByEmail: actor.email
    };
}

/**
 * Create audit fields for document update
 * Use when updating EXISTING documents in Firestore
 * 
 * CRITICAL: Do NOT include createdAt/createdBy fields
 * These must never be overwritten
 * 
 * @param {Object} user - Firebase Auth user object
 * @param {Object|null} profile - User profile from live_user_profiles
 * @param {Object} options - { useServerTimestamp: true }
 * @returns {Object} - Audit fields for update
 */
export function createAuditUpdateFields(user, profile = null, options = {}) {
    const actor = resolveCurrentActor(user, profile);
    const useServerTimestamp = options.useServerTimestamp !== false;
    const now = new Date().toISOString();
    
    return {
        updatedAt: useServerTimestamp ? serverTimestamp() : now,
        updatedAtClient: now,
        updatedByUid: actor.uid,
        updatedByName: actor.name,
        updatedByEmail: actor.email
    };
}

/**
 * Create audit fields for task/control completion
 * Use when marking tasks, controls, or entries as completed
 * 
 * @param {Object} user - Firebase Auth user object
 * @param {Object|null} profile - User profile from live_user_profiles
 * @param {Object} options - { useServerTimestamp: true }
 * @returns {Object} - Audit fields for completion
 */
export function createAuditCompleteFields(user, profile = null, options = {}) {
    const actor = resolveCurrentActor(user, profile);
    const useServerTimestamp = options.useServerTimestamp !== false;
    const now = new Date().toISOString();
    
    return {
        completedAt: useServerTimestamp ? serverTimestamp() : now,
        completedAtClient: now,
        completedByUid: actor.uid,
        completedByName: actor.name,
        completedByEmail: actor.email,
        
        updatedAt: useServerTimestamp ? serverTimestamp() : now,
        updatedAtClient: now,
        updatedByUid: actor.uid,
        updatedByName: actor.name,
        updatedByEmail: actor.email
    };
}

/**
 * Resolve audit display data from document
 * Use for displaying audit trail in UI
 * 
 * @param {Object} data - Firestore document data
 * @returns {Object} - Formatted audit display data
 */
export function resolveAuditDisplay(data) {
    if (!data) {
        return {
            createdAt: null,
            createdAtFormatted: "—",
            createdByName: "Ukendt",
            completedAt: null,
            completedAtFormatted: "—",
            completedByName: "—",
            updatedAt: null,
            updatedAtFormatted: "—",
            updatedByName: "—",
            warnings: ["missing_data"]
        };
    }
    
    const warnings = [];
    
    // Resolve created timestamp
    let createdAt = null;
    let createdSource = "none";
    
    if (data.createdAt) {
        createdAt = normalizeTimestamp(data.createdAt);
        createdSource = "createdAt";
    } else if (data.createdAtClient) {
        createdAt = normalizeTimestamp(data.createdAtClient);
        createdSource = "createdAtClient";
        warnings.push("used_client_created_at");
    } else if (data.dateKey) {
        createdAt = new Date(data.dateKey + "T00:00:00");
        createdSource = "dateKey";
        warnings.push("fallback_datekey_created");
    } else {
        warnings.push("missing_created_at");
    }
    
    // Resolve completed timestamp
    let completedAt = null;
    let completedSource = "none";
    
    if (data.completedAt) {
        completedAt = normalizeTimestamp(data.completedAt);
        completedSource = "completedAt";
    } else if (data.completedAtClient) {
        completedAt = normalizeTimestamp(data.completedAtClient);
        completedSource = "completedAtClient";
        warnings.push("used_client_completed_at");
    } else if (data.documentedAt) {
        completedAt = normalizeTimestamp(data.documentedAt);
        completedSource = "documentedAt";
        warnings.push("fallback_documented_at");
    } else if (data.handledAt) {
        completedAt = normalizeTimestamp(data.handledAt);
        completedSource = "handledAt";
        warnings.push("fallback_handled_at");
    }
    
    // Resolve updated timestamp
    let updatedAt = null;
    let updatedSource = "none";
    
    if (data.updatedAt) {
        updatedAt = normalizeTimestamp(data.updatedAt);
        updatedSource = "updatedAt";
    } else if (data.updatedAtClient) {
        updatedAt = normalizeTimestamp(data.updatedAtClient);
        updatedSource = "updatedAtClient";
        warnings.push("used_client_updated_at");
    }
    
    // Resolve created by name
    let createdByName = "Ukendt";
    if (data.createdByName) {
        createdByName = String(data.createdByName).trim();
    } else if (data.createdByEmail) {
        createdByName = String(data.createdByEmail).trim();
        warnings.push("used_email_as_created_by");
    } else if (data.createdByUid) {
        createdByName = String(data.createdByUid).substring(0, 8) + "...";
        warnings.push("used_uid_as_created_by");
    } else {
        warnings.push("missing_created_by");
    }
    
    // Resolve completed by name
    let completedByName = "—";
    if (data.completedByName) {
        completedByName = String(data.completedByName).trim();
    } else if (data.performedByName) {
        completedByName = String(data.performedByName).trim();
        warnings.push("used_performed_by_name");
    } else if (data.completedByEmail) {
        completedByName = String(data.completedByEmail).trim();
        warnings.push("used_email_as_completed_by");
    } else if (data.completedByUid) {
        completedByName = String(data.completedByUid).substring(0, 8) + "...";
        warnings.push("used_uid_as_completed_by");
    } else if (completedAt) {
        warnings.push("missing_completed_by");
    }
    
    // Resolve updated by name
    let updatedByName = "—";
    if (data.updatedByName) {
        updatedByName = String(data.updatedByName).trim();
    } else if (data.updatedByEmail) {
        updatedByName = String(data.updatedByEmail).trim();
        warnings.push("used_email_as_updated_by");
    } else if (data.updatedByUid) {
        updatedByName = String(data.updatedByUid).substring(0, 8) + "...";
        warnings.push("used_uid_as_updated_by");
    } else if (updatedAt) {
        warnings.push("missing_updated_by");
    }
    
    return {
        createdAt,
        createdAtFormatted: formatTimestamp(createdAt),
        createdByName,
        completedAt,
        completedAtFormatted: formatTimestamp(completedAt),
        completedByName,
        updatedAt,
        updatedAtFormatted: formatTimestamp(updatedAt),
        updatedByName,
        source: {
            created: createdSource,
            completed: completedSource,
            updated: updatedSource
        },
        warnings: [...new Set(warnings)] // Deduplicate
    };
}

/**
 * Normalize audit fields from legacy data
 * Use for migrating old documents to new audit contract
 * 
 * CRITICAL: Does NOT overwrite existing audit fields
 * Only fills in missing fields with fallbacks
 * 
 * @param {Object} data - Firestore document data
 * @returns {Object} - Normalized audit fields (partial update)
 */
export function normalizeAuditFields(data) {
    if (!data) return {};
    
    const normalized = {};
    
    // Only add createdAt if missing
    if (!data.createdAt && !data.createdAtClient) {
        if (data.dateKey) {
            normalized.createdAtClient = data.dateKey + "T00:00:00";
        } else if (data.performedAt) {
            normalized.createdAtClient = normalizeTimestamp(data.performedAt)?.toISOString() || null;
        }
    }
    
    // Only add completedAt if missing but has completion indicators
    if (!data.completedAt && !data.completedAtClient) {
        if (data.documentedAt) {
            normalized.completedAtClient = normalizeTimestamp(data.documentedAt)?.toISOString() || null;
        } else if (data.handledAt) {
            normalized.completedAtClient = normalizeTimestamp(data.handledAt)?.toISOString() || null;
        } else if (data.performedAt) {
            normalized.completedAtClient = normalizeTimestamp(data.performedAt)?.toISOString() || null;
        }
    }
    
    // Only add createdByName if missing
    if (!data.createdByName) {
        if (data.createdByEmail) {
            normalized.createdByName = data.createdByEmail;
        } else if (data.userName) {
            normalized.createdByName = data.userName;
        } else if (data.userEmail) {
            normalized.createdByName = data.userEmail;
        }
    }
    
    // Only add completedByName if missing
    if (!data.completedByName) {
        if (data.performedByName) {
            normalized.completedByName = data.performedByName;
        } else if (data.responsibleName) {
            normalized.completedByName = data.responsibleName;
        } else if (data.completedByEmail) {
            normalized.completedByName = data.completedByEmail;
        }
    }
    
    return normalized;
}

/**
 * Helper: Normalize Firestore timestamp to JavaScript Date
 * 
 * @param {*} value - Firestore timestamp, Date, ISO string, or null
 * @returns {Date|null} - JavaScript Date or null
 */
function normalizeTimestamp(value) {
    if (!value) return null;
    
    // Firestore Timestamp with toDate()
    if (value && typeof value.toDate === "function") {
        try {
            return value.toDate();
        } catch (e) {
            console.warn("[auditFields] Failed to convert Firestore timestamp:", e);
            return null;
        }
    }
    
    // Already a Date object
    if (value instanceof Date) {
        return isNaN(value.getTime()) ? null : value;
    }
    
    // ISO string or timestamp number
    if (typeof value === "string" || typeof value === "number") {
        const parsed = new Date(value);
        return isNaN(parsed.getTime()) ? null : parsed;
    }
    
    return null;
}

/**
 * Helper: Format timestamp for Danish locale display
 * 
 * @param {Date|null} date - JavaScript Date
 * @returns {string} - Formatted date or "—"
 */
function formatTimestamp(date) {
    if (!date) return "—";
    
    try {
        return new Intl.DateTimeFormat("da-DK", {
            dateStyle: "short",
            timeStyle: "short"
        }).format(date);
    } catch (e) {
        console.warn("[auditFields] Date formatting failed:", e);
        return "—";
    }
}
