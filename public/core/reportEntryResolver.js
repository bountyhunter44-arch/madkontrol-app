/**
 * REPORT ENTRY RESOLVER - CENTRAL NORMALIZATION
 * 
 * Purpose: Single source of truth for report entry normalization
 * Handles: timestamps, performers, status, category, warnings
 * 
 * CRITICAL: This resolver provides consistent data contracts for report rendering.
 * DO NOT modify priority order without understanding full impact.
 * 
 * Created: 2026-05-11
 * Phase: 2 - Foundation (no runtime changes yet)
 * Updated: 2026-05-11 - Added audit fields integration
 */

import { resolveTaskTitle } from "./taskTitleResolver.js";
import { resolveAuditDisplay } from "./auditFields.js";

/**
 * Normalize Firestore date value to JavaScript Date
 * Handles: Firestore Timestamp, Date object, ISO string, null
 * 
 * @param {*} value - Firestore timestamp, Date, string, or null
 * @returns {Date|null} - JavaScript Date or null
 */
export function normalizeFirestoreDate(value) {
    if (!value) return null;
    
    // Firestore Timestamp with toDate()
    if (value && typeof value.toDate === "function") {
        try {
            return value.toDate();
        } catch (e) {
            console.warn("[reportEntryResolver] Failed to convert Firestore timestamp:", e);
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
 * Format report date for display
 * 
 * @param {*} value - Date value to format
 * @param {string} fallback - Fallback text if no date
 * @returns {string} - Formatted date or fallback
 */
export function formatReportDate(value, fallback = "—") {
    const date = normalizeFirestoreDate(value);
    if (!date) return fallback;
    
    try {
        return new Intl.DateTimeFormat("da-DK", {
            dateStyle: "short",
            timeStyle: "short"
        }).format(date);
    } catch (e) {
        console.warn("[reportEntryResolver] Date formatting failed:", e);
        return fallback;
    }
}

/**
 * Resolve entry creation timestamp
 * Priority order documented in PHASE2_REPORT_NORMALIZATION_PLAN.md
 * 
 * @param {Object} entry - Task entry object
 * @param {Object|null} instance - Optional task instance for fallback
 * @returns {Object} - { timestamp: Date|null, source: string, warnings: string[] }
 */
export function resolveEntryCreatedTimestamp(entry, instance = null) {
    const warnings = [];
    
    // Priority 1: createdAt (PRIMARY)
    if (entry?.createdAt) {
        const date = normalizeFirestoreDate(entry.createdAt);
        if (date) return { timestamp: date, source: "entry.createdAt", warnings };
    }
    
    // Priority 2: createdAtClient (client-side creation)
    if (entry?.createdAtClient) {
        const date = normalizeFirestoreDate(entry.createdAtClient);
        if (date) {
            warnings.push("used_client_timestamp");
            return { timestamp: date, source: "entry.createdAtClient", warnings };
        }
    }
    
    // Priority 3: entryCreatedAt (explicit entry creation)
    if (entry?.entryCreatedAt) {
        const date = normalizeFirestoreDate(entry.entryCreatedAt);
        if (date) return { timestamp: date, source: "entry.entryCreatedAt", warnings };
    }
    
    // Priority 4: taskInstanceCreatedAt (denormalized from instance)
    if (entry?.taskInstanceCreatedAt) {
        const date = normalizeFirestoreDate(entry.taskInstanceCreatedAt);
        if (date) return { timestamp: date, source: "entry.taskInstanceCreatedAt", warnings };
    }
    
    // Priority 5: taskInstance.createdAt (from merged instance)
    if (entry?.taskInstance?.createdAt) {
        const date = normalizeFirestoreDate(entry.taskInstance.createdAt);
        if (date) {
            warnings.push("used_nested_instance");
            return { timestamp: date, source: "entry.taskInstance.createdAt", warnings };
        }
    }
    
    // Priority 6: instance.createdAt (passed separately)
    if (instance?.createdAt) {
        const date = normalizeFirestoreDate(instance.createdAt);
        if (date) {
            warnings.push("used_separate_instance");
            return { timestamp: date, source: "instance.createdAt", warnings };
        }
    }
    
    // Priority 7: performedAt (fallback)
    if (entry?.performedAt) {
        const date = normalizeFirestoreDate(entry.performedAt);
        if (date) {
            warnings.push("fallback_performed_at");
            return { timestamp: date, source: "entry.performedAt", warnings };
        }
    }
    
    // Priority 8: documentedAt (fallback)
    if (entry?.documentedAt) {
        const date = normalizeFirestoreDate(entry.documentedAt);
        if (date) {
            warnings.push("fallback_documented_at");
            return { timestamp: date, source: "entry.documentedAt", warnings };
        }
    }
    
    // Priority 9: dateKey (last resort - string only, no time)
    if (entry?.dateKey && /^\d{4}-\d{2}-\d{2}$/.test(entry.dateKey)) {
        const date = new Date(entry.dateKey + "T00:00:00");
        if (!isNaN(date.getTime())) {
            warnings.push("fallback_datekey_used");
            warnings.push("missing_created_at");
            return { timestamp: date, source: "entry.dateKey", warnings };
        }
    }
    
    warnings.push("missing_created_at");
    return { timestamp: null, source: "none", warnings };
}

/**
 * Resolve entry completion timestamp
 * Priority order documented in PHASE2_REPORT_NORMALIZATION_PLAN.md
 * 
 * @param {Object} entry - Task entry object
 * @param {Object|null} instance - Optional task instance for fallback
 * @returns {Object} - { timestamp: Date|null, source: string, warnings: string[] }
 */
export function resolveEntryCompletedTimestamp(entry, instance = null) {
    const warnings = [];
    
    // Priority 1: completedAt (PRIMARY)
    if (entry?.completedAt) {
        const date = normalizeFirestoreDate(entry.completedAt);
        if (date) return { timestamp: date, source: "entry.completedAt", warnings };
    }
    
    // Priority 2: completedAtClient (client-side)
    if (entry?.completedAtClient) {
        const date = normalizeFirestoreDate(entry.completedAtClient);
        if (date) {
            warnings.push("used_client_timestamp");
            return { timestamp: date, source: "entry.completedAtClient", warnings };
        }
    }
    
    // Priority 3: documentedAt (alternative)
    if (entry?.documentedAt) {
        const date = normalizeFirestoreDate(entry.documentedAt);
        if (date) {
            warnings.push("used_documented_at");
            return { timestamp: date, source: "entry.documentedAt", warnings };
        }
    }
    
    // Priority 4: handledAt (alternative)
    if (entry?.handledAt) {
        const date = normalizeFirestoreDate(entry.handledAt);
        if (date) {
            warnings.push("used_handled_at");
            return { timestamp: date, source: "entry.handledAt", warnings };
        }
    }
    
    // Priority 5: finishedAt (alternative)
    if (entry?.finishedAt) {
        const date = normalizeFirestoreDate(entry.finishedAt);
        if (date) {
            warnings.push("used_finished_at");
            return { timestamp: date, source: "entry.finishedAt", warnings };
        }
    }
    
    // Priority 6: closedAt (alternative)
    if (entry?.closedAt) {
        const date = normalizeFirestoreDate(entry.closedAt);
        if (date) {
            warnings.push("used_closed_at");
            return { timestamp: date, source: "entry.closedAt", warnings };
        }
    }
    
    // Priority 7: taskInstanceCompletedAt (denormalized)
    if (entry?.taskInstanceCompletedAt) {
        const date = normalizeFirestoreDate(entry.taskInstanceCompletedAt);
        if (date) return { timestamp: date, source: "entry.taskInstanceCompletedAt", warnings };
    }
    
    // Priority 8: taskInstance.completedAt (nested)
    if (entry?.taskInstance?.completedAt) {
        const date = normalizeFirestoreDate(entry.taskInstance.completedAt);
        if (date) {
            warnings.push("used_nested_instance");
            return { timestamp: date, source: "entry.taskInstance.completedAt", warnings };
        }
    }
    
    // Priority 9: instance.completedAt (passed separately)
    if (instance?.completedAt) {
        const date = normalizeFirestoreDate(instance.completedAt);
        if (date) {
            warnings.push("used_separate_instance");
            return { timestamp: date, source: "instance.completedAt", warnings };
        }
    }
    
    // Priority 10: performedAt (fallback)
    if (entry?.performedAt) {
        const date = normalizeFirestoreDate(entry.performedAt);
        if (date) {
            warnings.push("fallback_performed_at");
            return { timestamp: date, source: "entry.performedAt", warnings };
        }
    }
    
    // Priority 11: updatedAt (last resort)
    if (entry?.updatedAt) {
        const date = normalizeFirestoreDate(entry.updatedAt);
        if (date) {
            warnings.push("fallback_updated_at");
            return { timestamp: date, source: "entry.updatedAt", warnings };
        }
    }
    
    warnings.push("missing_completed_at");
    return { timestamp: null, source: "none", warnings };
}

/**
 * Resolve alert creation timestamp
 * 
 * @param {Object} alert - Alert object
 * @returns {Object} - { timestamp: Date|null, source: string, warnings: string[] }
 */
export function resolveAlertCreatedTimestamp(alert) {
    const warnings = [];
    
    if (alert?.createdAt) {
        const date = normalizeFirestoreDate(alert.createdAt);
        if (date) return { timestamp: date, source: "alert.createdAt", warnings };
    }
    
    if (alert?.createdAtClient) {
        const date = normalizeFirestoreDate(alert.createdAtClient);
        if (date) {
            warnings.push("used_client_timestamp");
            return { timestamp: date, source: "alert.createdAtClient", warnings };
        }
    }
    
    if (alert?.dateKey && /^\d{4}-\d{2}-\d{2}$/.test(alert.dateKey)) {
        const date = new Date(alert.dateKey + "T00:00:00");
        if (!isNaN(date.getTime())) {
            warnings.push("fallback_datekey_used");
            warnings.push("missing_created_at");
            return { timestamp: date, source: "alert.dateKey", warnings };
        }
    }
    
    warnings.push("missing_created_at");
    return { timestamp: null, source: "none", warnings };
}

/**
 * Resolve alert handled timestamp
 * 
 * @param {Object} alert - Alert object
 * @returns {Object} - { timestamp: Date|null, source: string, warnings: string[] }
 */
export function resolveAlertHandledTimestamp(alert) {
    const warnings = [];
    
    if (alert?.correctiveActionCompletedAt) {
        const date = normalizeFirestoreDate(alert.correctiveActionCompletedAt);
        if (date) return { timestamp: date, source: "alert.correctiveActionCompletedAt", warnings };
    }
    
    if (alert?.closedAt) {
        const date = normalizeFirestoreDate(alert.closedAt);
        if (date) return { timestamp: date, source: "alert.closedAt", warnings };
    }
    
    if (alert?.resolvedAt) {
        const date = normalizeFirestoreDate(alert.resolvedAt);
        if (date) return { timestamp: date, source: "alert.resolvedAt", warnings };
    }
    
    if (alert?.lastHandledAt) {
        const date = normalizeFirestoreDate(alert.lastHandledAt);
        if (date) return { timestamp: date, source: "alert.lastHandledAt", warnings };
    }
    
    if (alert?.updatedAt) {
        const date = normalizeFirestoreDate(alert.updatedAt);
        if (date) {
            warnings.push("fallback_updated_at");
            return { timestamp: date, source: "alert.updatedAt", warnings };
        }
    }
    
    warnings.push("missing_completed_at");
    return { timestamp: null, source: "none", warnings };
}

function normalizeNameForCompare(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function collectCompanyNameCandidates(entry = null, profile = null) {
    return [
        entry?.companyName,
        entry?.profileCompanyName,
        entry?.companyDisplayName,
        entry?.businessName,
        entry?.organizationName,
        entry?.restaurantName,
        entry?.locationName,
        entry?.locationDisplayName,
        entry?.profile?.companyName,
        entry?.profile?.profileCompanyName,
        entry?.profile?.locationName,
        profile?.companyName,
        profile?.profileCompanyName,
        profile?.companyDisplayName,
        profile?.businessName,
        profile?.organizationName,
        profile?.restaurantName,
        profile?.locationName,
        profile?.locationDisplayName,
        profile?.profile?.companyName,
        profile?.profile?.profileCompanyName,
        profile?.profile?.locationName
    ]
        .map(normalizeNameForCompare)
        .filter(Boolean);
}

/**
 * Detect values that look like business names and must not be rendered as people.
 *
 * @param {*} name - Candidate actor name
 * @param {Object|null} entry - Task entry and optional profile/company context
 * @param {Object|null} profile - Optional user/company profile context
 * @returns {boolean}
 */
export function isCompanyLikeName(name, entry = null, profile = null) {
    const rawName = String(name || "").trim();
    const normalizedName = normalizeNameForCompare(rawName);
    if (!normalizedName) return false;

    const candidates = collectCompanyNameCandidates(entry, profile);
    if (candidates.includes(normalizedName)) return true;

    const displayName = normalizeNameForCompare(entry?.displayName || profile?.displayName || profile?.profile?.displayName);
    if (displayName && normalizedName === displayName) {
        const displayNameLooksCompany =
            candidates.includes(displayName) ||
            /\b(aps|a s|as|ivs|is|i s|restaurant|restauranten|cafe|café|cafeteria|hotel|pizzeria|pizza|grill|bar|bistro|kro|kantine|takeaway|sushi|burger|bakery|bager|slagter|smorrebrod|smorrebroed|kokken|koekken)\b/.test(displayName);
        if (displayNameLooksCompany) return true;
    }

    return /\b(aps|a s|as|ivs|is|i s|restaurant|restauranten|cafe|café|cafeteria|hotel|pizzeria|pizza|grill|bar|bistro|kro|kantine|takeaway|sushi|burger|bakery|bager|slagter|smorrebrod|smorrebroed|kokken|koekken)\b/.test(normalizedName);
}

function resolveActorCandidate(entry, profile, field, warning = null) {
    const value = String(entry?.[field] || "").trim();
    if (!value) return null;

    if (isCompanyLikeName(value, entry, profile)) {
        return {
            blocked: true,
            originalValue: value,
            source: `entry.${field}`,
            warning: `blocked_company_like_${field}`
        };
    }

    return {
        name: value,
        source: `entry.${field}`,
        warnings: warning ? [warning] : []
    };
}

/**
 * Resolve the report actor with runtime company-name blocking.
 *
 * @param {Object} entry - Task entry object
 * @param {Object|null} profile - Optional company/profile context
 * @returns {Object} - { name, source, blockedCompanyName, warnings }
 */
export function resolveEntryActor(entry, profile = null) {
    const warnings = [];
    let blockedCompanyName = false;
    let blockedOriginalValue = "";

    const nameCandidates = [
        ["completedByName", null],
        ["createdByName", "used_created_by"],
        ["responsibleName", "used_responsible_name"]
    ];

    for (const [field, warning] of nameCandidates) {
        const resolved = resolveActorCandidate(entry, profile, field, warning);
        if (!resolved) continue;

        if (resolved.blocked) {
            blockedCompanyName = true;
            blockedOriginalValue = blockedOriginalValue || resolved.originalValue;
            warnings.push(resolved.warning);
            continue;
        }

        console.log("[actor normalization]", {
            originalValue: resolved.name,
            blocked: false,
            resolved: resolved.name,
            source: resolved.source
        });

        return {
            name: resolved.name,
            source: resolved.source,
            blockedCompanyName,
            warnings: [...new Set([...warnings, ...resolved.warnings])]
        };
    }

    const emailCandidates = [
        ["completedByEmail", "used_completed_email"],
        ["createdByEmail", "used_created_email"]
    ];

    for (const [field, warning] of emailCandidates) {
        const value = String(entry?.[field] || "").trim();
        if (!value) continue;

        warnings.push(warning);
        console.log("[actor normalization]", {
            originalValue: blockedOriginalValue || value,
            blocked: blockedCompanyName,
            resolved: value,
            source: `entry.${field}`
        });

        return {
            name: value,
            source: `entry.${field}`,
            blockedCompanyName,
            warnings: [...new Set(warnings)]
        };
    }

    warnings.push("missing_actor");
    console.log("[actor normalization]", {
        originalValue: blockedOriginalValue || "",
        blocked: blockedCompanyName,
        resolved: "Ukendt medarbejder",
        source: "fallback"
    });

    return {
        name: "Ukendt medarbejder",
        source: "fallback",
        blockedCompanyName,
        warnings: [...new Set(warnings)]
    };
}

/**
 * Resolve entry performer (who completed the task)
 * Priority order documented in PHASE2_REPORT_NORMALIZATION_PLAN.md
 * 
 * @param {Object} entry - Task entry object
 * @param {Object|null} instance - Optional task instance for fallback
 * @returns {Object} - { name: string, source: string, warnings: string[] }
 */
export function resolveEntryPerformer(entry, instance = null) {
    return resolveEntryActor(entry, instance);
}

/**
 * Resolve entry status
 * 
 * @param {Object} entry - Task entry object
 * @param {Object|null} instance - Optional task instance
 * @returns {Object} - { status: string, source: string, warnings: string[] }
 */
export function resolveEntryStatus(entry, instance = null) {
    const warnings = [];
    
    // Check entry status
    if (entry?.status && String(entry.status).trim()) {
        return {
            status: String(entry.status).trim(),
            source: "entry.status",
            warnings
        };
    }
    
    // Check instance status
    if (instance?.status && String(instance.status).trim()) {
        warnings.push("used_instance_status");
        return {
            status: String(instance.status).trim(),
            source: "instance.status",
            warnings
        };
    }
    
    // Infer from timestamps
    const completed = resolveEntryCompletedTimestamp(entry, instance);
    if (completed.timestamp) {
        warnings.push("inferred_from_timestamp");
        return {
            status: "completed",
            source: "inferred",
            warnings
        };
    }
    
    warnings.push("missing_status");
    return {
        status: "unknown",
        source: "none",
        warnings
    };
}

/**
 * Resolve entry category
 * Extracted from rapporter.html resolveCategory function
 * 
 * @param {Object} entry - Task entry object
 * @param {Object|null} instance - Optional task instance
 * @returns {Object} - { category: string, source: string, warnings: string[] }
 */
export function resolveEntryCategory(entry, instance = null) {
    const warnings = [];
    
    // Check explicit category field
    if (entry?.category && String(entry.category).trim()) {
        return {
            category: String(entry.category).trim(),
            source: "entry.category",
            warnings
        };
    }
    
    // Infer from templateKey or canonicalTaskKey
    const key = String(
        entry?.templateKey || 
        entry?.canonicalTaskKey || 
        entry?.routineType ||
        instance?.templateKey ||
        instance?.canonicalTaskKey ||
        instance?.routineType ||
        ""
    ).toLowerCase();
    
    if (key.includes("rengoering") || key.includes("rengøring")) {
        warnings.push("inferred_from_key");
        return { category: "Rengøring", source: "templateKey", warnings };
    }
    if (key.includes("temperatur")) {
        warnings.push("inferred_from_key");
        return { category: "Temperaturkontrol", source: "templateKey", warnings };
    }
    if (key.includes("nedkoeling") || key.includes("nedkøling")) {
        warnings.push("inferred_from_key");
        return { category: "Nedkøling", source: "templateKey", warnings };
    }
    if (key.includes("opvarmning")) {
        warnings.push("inferred_from_key");
        return { category: "Opvarmning", source: "templateKey", warnings };
    }
    if (key.includes("roegning") || key.includes("rogning") || key.includes("smoking")) {
        warnings.push("inferred_from_key");
        return { category: "Røgning", source: "templateKey", warnings };
    }
    if (key.includes("varmholdelse")) {
        warnings.push("inferred_from_key");
        return { category: "Varmholdelse", source: "templateKey", warnings };
    }
    if (key.includes("varemodtagelse")) {
        warnings.push("inferred_from_key");
        return { category: "Varemodtagelse", source: "templateKey", warnings };
    }
    if (key.includes("tre_timers")) {
        warnings.push("inferred_from_key");
        return { category: "3-timers regel", source: "templateKey", warnings };
    }
    if (key.includes("adskillelse")) {
        warnings.push("inferred_from_key");
        return { category: "Adskillelse", source: "templateKey", warnings };
    }
    if (key.includes("allergener")) {
        warnings.push("inferred_from_key");
        return { category: "Allergener", source: "templateKey", warnings };
    }
    if (key.includes("opbevaring")) {
        warnings.push("inferred_from_key");
        return { category: "Opbevaring", source: "templateKey", warnings };
    }
    if (key.includes("personlig_hygiejne")) {
        warnings.push("inferred_from_key");
        return { category: "Personlig hygiejne", source: "templateKey", warnings };
    }
    if (key.includes("sporbarhed")) {
        warnings.push("inferred_from_key");
        return { category: "Sporbarhed", source: "templateKey", warnings };
    }
    
    // Fallback to taskType or generic
    if (entry?.taskType && String(entry.taskType).trim()) {
        warnings.push("used_task_type");
        return {
            category: String(entry.taskType).trim(),
            source: "entry.taskType",
            warnings
        };
    }
    
    warnings.push("missing_category");
    return {
        category: "Egenkontrol",
        source: "default",
        warnings
    };
}

/**
 * Normalize complete report entry
 * Returns stable contract for report rendering
 * 
 * @param {Object} entry - Task entry object
 * @param {Object|null} instance - Optional task instance
 * @returns {Object} - Normalized entry with stable contract
 */
export function normalizeReportEntry(entry, instance = null) {
    if (!entry) {
        return {
            title: "Ukendt opgave",
            createdAt: null,
            completedAt: null,
            createdAtFormatted: "—",
            completedAtFormatted: "—",
            performedByName: "Ukendt medarbejder",
            createdByName: "—",
            status: "unknown",
            category: "Egenkontrol",
            measurement: "",
            documentation: "",
            equipment: "",
            source: "none",
            warnings: ["missing_entry"]
        };
    }
    
    const created = resolveEntryCreatedTimestamp(entry, instance);
    const completed = resolveEntryCompletedTimestamp(entry, instance);
    const performer = resolveEntryActor(entry, instance);
    const status = resolveEntryStatus(entry, instance);
    const category = resolveEntryCategory(entry, instance);
    
    // Resolve title using existing taskTitleResolver
    let title = "Ukendt opgave";
    try {
        title = resolveTaskTitle(entry) || title;
    } catch (e) {
        console.warn("[reportEntryResolver] Title resolution failed:", e);
    }
    
    // Collect all warnings
    const allWarnings = [
        ...created.warnings,
        ...completed.warnings,
        ...performer.warnings,
        ...status.warnings,
        ...category.warnings
    ];
    
    // Remove duplicates
    const uniqueWarnings = [...new Set(allWarnings)];
    
    return {
        title,
        createdAt: created.timestamp,
        completedAt: completed.timestamp,
        createdAtFormatted: formatReportDate(created.timestamp),
        completedAtFormatted: formatReportDate(completed.timestamp),
        performedByName: performer.name,
        createdByName: entry?.createdByName || "—",
        status: status.status,
        category: category.category,
        measurement: String(entry?.measurement || entry?.value || entry?.temperature || "").trim(),
        documentation: String(entry?.note || entry?.comment || entry?.description || "").trim(),
        equipment: String(entry?.equipmentName || entry?.unitName || entry?.areaName || "").trim(),
        source: {
            created: created.source,
            completed: completed.source,
            performer: performer.source,
            status: status.source,
            category: category.source
        },
        warnings: uniqueWarnings
    };
}

/**
 * Resolve report entry audit trail using central audit fields
 * Delegates to auditFields.js for consistent audit resolution
 * 
 * @param {Object} entry - Task entry object
 * @returns {Object} - Audit display data
 */
export function resolveReportEntryAudit(entry) {
    const audit = resolveAuditDisplay(entry);
    const actor = resolveEntryActor(entry);

    return {
        ...audit,
        completedByName: actor.name,
        actor,
        warnings: [...new Set([...(audit.warnings || []), ...(actor.warnings || [])])]
    };
}
