const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();
const { Timestamp } = admin.firestore;

/**
 * Generate dateKey in YYYY-MM-DD format for a given date in a specific timezone
 * @param {Date} date - Date object
 * @param {string} timeZone - IANA timezone
 * @returns {string} - Date key in YYYY-MM-DD format
 */
function getDateKey(date, timeZone = "Europe/Copenhagen") {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(date);

    const year = parts.find((p) => p.type === "year")?.value;
    const month = parts.find((p) => p.type === "month")?.value;
    const day = parts.find((p) => p.type === "day")?.value;

    return `${year}-${month}-${day}`;
}

/**
 * Get weekday number (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
 * @param {Date} date - Date object
 * @param {string} timeZone - IANA timezone
 * @returns {number} - Weekday number
 */
function getWeekday(date, timeZone = "Europe/Copenhagen") {
    const weekday = new Intl.DateTimeFormat("en-US", {
        timeZone,
        weekday: "short"
    }).format(date);

    const map = {
        Sun: 0,
        Mon: 1,
        Tue: 2,
        Wed: 3,
        Thu: 4,
        Fri: 5,
        Sat: 6
    };

    return map[weekday];
}

/**
 * Get day of month (1-31)
 * @param {Date} date - Date object
 * @param {string} timeZone - IANA timezone
 * @returns {number} - Day of month
 */
function getDayOfMonth(date, timeZone = "Europe/Copenhagen") {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        day: "2-digit"
    }).formatToParts(date);

    return Number(parts.find((p) => p.type === "day")?.value || 0);
}

/**
 * Check if date is a weekday (Monday-Friday)
 * @param {Date} date - Date object
 * @param {string} timeZone - IANA timezone
 * @returns {boolean} - True if weekday
 */
function isWeekday(date, timeZone = "Europe/Copenhagen") {
    const day = getWeekday(date, timeZone);
    return day >= 1 && day <= 5;
}

/**
 * Check if date is a weekend (Saturday-Sunday)
 * @param {Date} date - Date object
 * @param {string} timeZone - IANA timezone
 * @returns {boolean} - True if weekend
 */
function isWeekend(date, timeZone = "Europe/Copenhagen") {
    const day = getWeekday(date, timeZone);
    return day === 0 || day === 6;
}

/**
 * Get operating mode for a location on a specific date
 * @param {string} locationId - Location ID
 * @param {string} dateKey - Date key in YYYY-MM-DD format
 * @returns {Promise<string|null>} - Operating mode ("open", "closed", "vacation") or null if no override
 */
async function getOperatingMode(locationId, dateKey) {
    try {
        if (!locationId) {
            return null;
        }

        const overrideDoc = await db
            .collection("operating_overrides")
            .doc(`${locationId}__${dateKey}`)
            .get();

        if (!overrideDoc.exists) {
            return null;
        }

        const data = overrideDoc.data();
        return data.mode || null;
    } catch (error) {
        console.error(`Error fetching operating mode for ${locationId} on ${dateKey}:`, error);
        return null;
    }
}

/**
 * Check if task should be generated for a specific date based on frequency
 * @param {object} template - Task template
 * @param {Date} date - Date to check
 * @param {string} timeZone - IANA timezone
 * @returns {boolean} - True if task should be generated
 */
function shouldGenerateForDate(template, date, timeZone = "Europe/Copenhagen") {
    const frequency = template.frequency || "daily";

    switch (frequency) {
        case "daily":
            return true;

        case "weekdays":
            return isWeekday(date, timeZone);

        case "weekends":
            return isWeekend(date, timeZone);

        case "weekly": {
            const daysOfWeek = template.daysOfWeek || [];
            if (daysOfWeek.length === 0) {
                console.warn(`Weekly template ${template.id} missing daysOfWeek config`);
                return false;
            }
            const weekday = getWeekday(date, timeZone);
            return daysOfWeek.includes(weekday);
        }

        case "monthly": {
            const daysOfMonth = template.daysOfMonth || [];
            if (daysOfMonth.length === 0) {
                console.warn(`Monthly template ${template.id} missing daysOfMonth config`);
                return false;
            }
            const dayOfMonth = getDayOfMonth(date, timeZone);
            return daysOfMonth.includes(dayOfMonth);
        }

        case "quarterly": {
            const month = Number(
                new Intl.DateTimeFormat("en-CA", {
                    timeZone,
                    month: "2-digit"
                }).format(date)
            );
            const dayOfMonth = getDayOfMonth(date, timeZone);
            return dayOfMonth === 1 && [1, 4, 7, 10].includes(month);
        }

        case "yearly": {
            const month = Number(
                new Intl.DateTimeFormat("en-CA", {
                    timeZone,
                    month: "2-digit"
                }).format(date)
            );
            const dayOfMonth = getDayOfMonth(date, timeZone);
            return month === 1 && dayOfMonth === 1;
        }

        case "every_2_hours":
        case "hourly":
            console.warn(`Hourly frequency ${frequency} for template ${template.id} - generating daily instance`);
            return true;

        default:
            console.warn(`Unknown frequency: ${frequency} for template ${template.id}`);
            return false;
    }
}

/**
 * Build stable task instance ID
 * @param {string} templateId - Template ID
 * @param {string} dateKey - Date key in YYYY-MM-DD format
 * @returns {string} - Task instance ID
 */
function buildTaskInstanceId(templateId, dateKey) {
    return `${templateId}__${dateKey}`;
}

/**
 * Build task instance payload from template
 * @param {object} template - Task template
 * @param {string} dateKey - Date key in YYYY-MM-DD format
 * @returns {object} - Task instance payload
 */
function buildTaskInstancePayload(template, dateKey) {
    const now = Timestamp.now();
    const taskInstanceId = buildTaskInstanceId(template.id, dateKey);
    const stableGuideKey = template.guideKey || template.controlType || template.taskType || "";
    const stableControlType = template.controlType || template.guideKey || template.taskType || "";

    return {
        id: taskInstanceId,
        taskInstanceId,
        templateId: template.id,
        taskTemplateId: template.id,
        taskId: template.id,
        sourceTemplateId: template.id,

        companyId: template.companyId || "",
        locationId: template.locationId || "",
        unitId: template.unitId || "",

        title: template.title || template.name || "",
        taskTitle: template.title || template.name || "",
        description: template.description || "",

        category: template.category || "",
        aggregatedCategory: template.aggregatedCategory || "",

        taskType: template.taskType || stableControlType,
        guideKey: stableGuideKey,
        guideVersion: template.guideVersion || "1.0",
        controlType: stableControlType,
        type: template.type || template.taskType || stableControlType,
        entryType: template.entryType || "check",
        processKey: template.processKey || "",

        equipmentName: template.equipmentName || "",
        equipmentType: template.equipmentType || "",

        frequency: template.frequency || "daily",
        requiresMeasurement: template.requiresMeasurement || false,
        measurementUnit: template.measurementUnit || "",
        limitMin: template.limitMin ?? null,
        limitMax: template.limitMax ?? null,
        limitUnit: template.limitUnit || template.measurementUnit || "",

        riskLevel: template.riskLevel || "",
        severity: template.severity || "",
        isCCP: template.isCCP || false,

        dateKey,
        status: "pending",
        completedAt: null,
        completedBy: null,
        completedByName: null,

        sourceRiskAnalysisIds: Array.isArray(template.sourceRiskAnalysisIds)
            ? template.sourceRiskAnalysisIds
            : (template.sourceRiskAnalysisIds ? [template.sourceRiskAnalysisIds] : []),

        createdAt: now,
        updatedAt: now,
        generatedAt: now
    };
}

/**
 * Get operational control definition
 * @param {string} controlKey - Control key
 * @returns {object|null} - Control definition or null
 */
function getOperationalControl(controlKey) {
    const controls = {
        fridge_temperature: {
            title: "Temperaturkontrol - {unitName}",
            controlType: "measurement",
            taskType: "measurement",
            category: "temperature",
            frequency: "daily",
            requiresMeasurement: true,
            measurementUnit: "°C",
            limitMax: 5,
            questions: [{ text: "Mål temperatur", type: "measurement" }]
        },
        fridge_cleaning: {
            title: "Rengøring - {unitName}",
            controlType: "checklist",
            taskType: "checklist",
            category: "cleaning",
            frequency: "daily",
            questions: [{ text: "Er køleskabet rengjort?", type: "yes_no" }]
        },
        fridge_maintenance: {
            title: "Vedligeholdelse - {unitName}",
            controlType: "checklist",
            taskType: "checklist",
            category: "maintenance",
            frequency: "daily",
            questions: [{ text: "Er køleskabet i god stand?", type: "yes_no" }]
        },
        freezer_temperature: {
            title: "Temperaturkontrol - {unitName}",
            controlType: "measurement",
            taskType: "measurement",
            category: "temperature",
            frequency: "daily",
            requiresMeasurement: true,
            measurementUnit: "°C",
            limitMax: -18,
            questions: [{ text: "Mål temperatur", type: "measurement" }]
        },
        freezer_cleaning: {
            title: "Rengøring - {unitName}",
            controlType: "checklist",
            taskType: "checklist",
            category: "cleaning",
            frequency: "daily",
            questions: [{ text: "Er fryseren rengjort?", type: "yes_no" }]
        },
        freezer_maintenance: {
            title: "Vedligeholdelse - {unitName}",
            controlType: "checklist",
            taskType: "checklist",
            category: "maintenance",
            frequency: "daily",
            questions: [{ text: "Er fryseren i god stand?", type: "yes_no" }]
        }
    };

    return controls[controlKey] || null;
}

/**
 * Build unit-based task instance
 * @param {string} controlKey - Control key
 * @param {object} unit - Unit object
 * @param {string} dateKey - Date key
 * @param {string} companyId - Company ID
 * @param {string} locationId - Location ID
 * @returns {object|null} - Task instance or null
 */
function buildUnitTask(controlKey, unit, dateKey, companyId, locationId) {
    const control = getOperationalControl(controlKey);

    if (!control) return null;

    const now = Timestamp.now();
    const templateId = `${controlKey}_${unit.id}`;
    const instanceId = `${templateId}__${dateKey}`;

    return {
        id: instanceId,
        taskInstanceId: instanceId,
        templateId,
        taskTemplateId: templateId,
        taskId: templateId,
        sourceTemplateId: `unit_${controlKey}`,

        companyId: companyId || unit.companyId || "",
        locationId: locationId || unit.locationId || "",
        unitId: unit.id,
        unitName: unit.name,

        title: control.title.replace("{unitName}", unit.name),
        taskTitle: control.title.replace("{unitName}", unit.name),
        description: "",

        category: control.category,
        aggregatedCategory: control.category,

        guideKey: controlKey,
        taskType: control.taskType,
        controlType: controlKey,
        type: control.taskType,
        entryType: "check",

        equipmentName: unit.name,
        equipmentType: unit.type,

        frequency: control.frequency,
        requiresMeasurement: control.requiresMeasurement || false,
        measurementUnit: control.measurementUnit || "",
        limitMax: control.limitMax ?? null,
        limitMin: control.limitMin ?? null,
        limitUnit: control.measurementUnit || "",

        questions: control.questions || [],

        dateKey,
        status: "pending",
        completedAt: null,
        completedBy: null,
        completedByName: null,

        createdAt: now,
        updatedAt: now,
        generatedAt: now
    };
}

/**
 * Create unit-based tasks for fridges and freezers
 * @param {Array} units - Array of unit objects
 * @param {string} dateKey - Date key
 * @param {string} companyId - Company ID
 * @param {string} locationId - Location ID
 * @returns {Array} - Array of task instances
 */
function createUnitBasedTasks(units, dateKey, companyId, locationId) {
    const tasks = [];

    for (const unit of units) {
        if (unit.type === "fridge") {
            const tempTask = buildUnitTask("fridge_temperature", unit, dateKey, companyId, locationId);
            const cleanTask = buildUnitTask("fridge_cleaning", unit, dateKey, companyId, locationId);
            const maintTask = buildUnitTask("fridge_maintenance", unit, dateKey, companyId, locationId);

            if (tempTask) tasks.push(tempTask);
            if (cleanTask) tasks.push(cleanTask);
            if (maintTask) tasks.push(maintTask);
        }

        if (unit.type === "freezer") {
            const tempTask = buildUnitTask("freezer_temperature", unit, dateKey, companyId, locationId);
            const cleanTask = buildUnitTask("freezer_cleaning", unit, dateKey, companyId, locationId);
            const maintTask = buildUnitTask("freezer_maintenance", unit, dateKey, companyId, locationId);

            if (tempTask) tasks.push(tempTask);
            if (cleanTask) tasks.push(cleanTask);
            if (maintTask) tasks.push(maintTask);
        }
    }

    return tasks;
}

/**
 * Create task instances for a specific date
 * @param {object} params - Parameters
 * @param {string} params.dateKey - Date key in YYYY-MM-DD format
 * @param {string} [params.locationId] - Optional location ID to filter templates
 * @param {string} [params.timeZone] - Time zone (default: Europe/Copenhagen)
 * @returns {Promise<object>} - Summary of created, skipped, and blocked tasks
 */
async function createTaskInstancesForDate({ dateKey, locationId = null, timeZone = "Europe/Copenhagen" }) {
    console.log(`\n🚀 Starting task instance generation for ${dateKey}`);

    const date = new Date(`${dateKey}T12:00:00`);
    const summary = {
        createdCount: 0,
        alreadyExistsCount: 0,
        notScheduledCount: 0,
        blockedCount: 0,
        created: [],
        alreadyExists: [],
        notScheduled: [],
        blocked: []
    };

    try {
        let templatesQuery = db
            .collection("task_templates")
            .where("isActive", "==", true);

        if (locationId) {
            templatesQuery = templatesQuery.where("locationId", "==", locationId);
        }

        const templatesSnapshot = await templatesQuery.get();

        if (templatesSnapshot.empty) {
            console.log("No active task templates found");
        } else {
            console.log(`Found ${templatesSnapshot.size} active task templates`);

            for (const templateDoc of templatesSnapshot.docs) {
                const template = { id: templateDoc.id, ...templateDoc.data() };

                if (!shouldGenerateForDate(template, date, timeZone)) {
                    summary.notScheduledCount++;
                    summary.notScheduled.push({
                        templateId: template.id,
                        title: template.title || template.name,
                        frequency: template.frequency,
                        reason: "not_scheduled_for_today"
                    });
                    continue;
                }

                const operatingMode = await getOperatingMode(template.locationId, dateKey);

                if (operatingMode === "closed" || operatingMode === "vacation") {
                    summary.blockedCount++;
                    summary.blocked.push({
                        templateId: template.id,
                        title: template.title || template.name,
                        reason: `operating_mode_${operatingMode}`
                    });
                    continue;
                }

                const instanceId = buildTaskInstanceId(template.id, dateKey);
                const instanceRef = db.collection("task_instances").doc(instanceId);

                const existingInstance = await instanceRef.get();
                if (existingInstance.exists) {
                    summary.alreadyExistsCount++;
                    summary.alreadyExists.push({
                        templateId: template.id,
                        title: template.title || template.name,
                        reason: "already_exists"
                    });
                    continue;
                }

                const payload = buildTaskInstancePayload(template, dateKey);

                if (!payload.taskInstanceId) {
                    payload.taskInstanceId = instanceId;
                }

                if (!payload.templateId) {
                    payload.templateId = template.id;
                }

                if (!payload.id) {
                    payload.id = instanceId;
                }

                if (!payload.guideKey) {
                    payload.guideKey = template.guideKey || template.controlType || template.taskType || "";
                }

                if (!payload.controlType) {
                    payload.controlType = template.controlType || template.guideKey || template.taskType || "";
                }

                if (!payload.taskType) {
                    payload.taskType = template.taskType || payload.controlType || "";
                }

                // FORCE UNIT TITLE OVERRIDE (MUST BE LAST BEFORE SAVE)
                if (payload.unitId && payload.controlType) {
                    const unitDoc = await db.collection("units").doc(payload.unitId).get();

                    if (unitDoc.exists) {
                        const unitName = unitDoc.data()?.name || "";

                        if (unitName) {
                            if (
                                payload.controlType === "fridge_temperature" ||
                                payload.controlType === "freezer_temperature"
                            ) {
                                payload.title = `Temperaturkontrol - ${unitName}`;
                                payload.taskTitle = `Temperaturkontrol - ${unitName}`;
                            }

                            if (
                                payload.controlType === "fridge_cleaning" ||
                                payload.controlType === "freezer_cleaning"
                            ) {
                                payload.title = `Rengøring - ${unitName}`;
                                payload.taskTitle = `Rengøring - ${unitName}`;
                            }

                            if (
                                payload.controlType === "fridge_maintenance" ||
                                payload.controlType === "freezer_maintenance"
                            ) {
                                payload.title = `Vedligeholdelse - ${unitName}`;
                                payload.taskTitle = `Vedligeholdelse - ${unitName}`;
                            }
                        }
                    }
                }

                await instanceRef.set(payload);

                summary.createdCount++;
                summary.created.push({
                    instanceId,
                    templateId: template.id,
                    title: payload.title || template.title || template.name,
                    category: template.category,
                    frequency: template.frequency
                });
            }
        }

        // Generate unit-based tasks for fridges and freezers
        console.log(`\n🔍 Checking for units (locationId: ${locationId || "ALL"})`);

        let unitsQuery = db.collection("units").where("isActive", "==", true);

        if (locationId) {
            unitsQuery = unitsQuery.where("locationId", "==", locationId);
        }

        const unitsSnapshot = await unitsQuery.get();
        console.log(`   Query returned ${unitsSnapshot.size} units`);

        if (!unitsSnapshot.empty) {
            console.log(`Found ${unitsSnapshot.size} active units`);

            const units = unitsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

            const fridgeCount = units.filter((u) => u.type === "fridge").length;
            const freezerCount = units.filter((u) => u.type === "freezer").length;
            console.log(`   Fridges: ${fridgeCount}, Freezers: ${freezerCount}`);

            const inferredCompanyId =
                units.find((u) => u.companyId)?.companyId ||
                (units[0]?.locationId ? String(units[0].locationId).split("__")[0] : "") ||
                "";

            const unitTasks = createUnitBasedTasks(units, dateKey, inferredCompanyId, locationId);
            console.log(`   Generated ${unitTasks.length} unit tasks`);

            for (const task of unitTasks) {
                const instanceRef = db.collection("task_instances").doc(task.id);
                const existingInstance = await instanceRef.get();

                if (!existingInstance.exists) {
                    const taskToSave = { ...task };

                    if (taskToSave.unitName) {
                        const controlKey = taskToSave.controlType || taskToSave.guideKey || "";

                        if (controlKey === "fridge_temperature" || controlKey === "freezer_temperature") {
                            taskToSave.title = `Temperaturkontrol - ${taskToSave.unitName}`;
                            taskToSave.taskTitle = `Temperaturkontrol - ${taskToSave.unitName}`;
                        } else if (controlKey === "fridge_cleaning" || controlKey === "freezer_cleaning") {
                            taskToSave.title = `Rengøring - ${taskToSave.unitName}`;
                            taskToSave.taskTitle = `Rengøring - ${taskToSave.unitName}`;
                        } else if (controlKey === "fridge_maintenance" || controlKey === "freezer_maintenance") {
                            taskToSave.title = `Vedligeholdelse - ${taskToSave.unitName}`;
                            taskToSave.taskTitle = `Vedligeholdelse - ${taskToSave.unitName}`;
                        }
                    }

                    if (!taskToSave.taskInstanceId) {
                        taskToSave.taskInstanceId = task.id;
                    }

                    if (!taskToSave.templateId) {
                        taskToSave.templateId = task.taskTemplateId;
                    }

                    if (!taskToSave.id) {
                        taskToSave.id = task.id;
                    }

                    if (!taskToSave.guideKey) {
                        taskToSave.guideKey = task.controlType || "";
                    }

                    if (!taskToSave.controlType) {
                        taskToSave.controlType = task.guideKey || "";
                    }

                    if (!taskToSave.taskType) {
                        taskToSave.taskType = task.type || "";
                    }

                    await instanceRef.set(taskToSave);

                    summary.createdCount++;
                    summary.created.push({
                        instanceId: task.id,
                        templateId: task.taskTemplateId,
                        title: taskToSave.title,
                        category: task.category,
                        frequency: task.frequency
                    });
                } else {
                    summary.alreadyExistsCount++;
                    summary.alreadyExists.push({
                        templateId: task.taskTemplateId,
                        title: task.title,
                        reason: "already_exists"
                    });
                }
            }

            console.log(`   Unit-based tasks created: ${unitTasks.length}`);
        }

        console.log(`\n✅ Task instance generation complete for ${dateKey}`);
        console.log(`   Created: ${summary.createdCount}`);
        console.log(`   Already exists: ${summary.alreadyExistsCount}`);
        console.log(`   Not scheduled for today: ${summary.notScheduledCount}`);
        console.log(`   Blocked by operating mode: ${summary.blockedCount}`);

        return summary;
    } catch (error) {
        console.error(`Error generating task instances for ${dateKey}:`, error);
        throw error;
    }
}

/**
 * Scheduled function: Generate daily task instances
 * Runs every day at 00:30 CET
 */
exports.generateDailyTaskInstances = onSchedule(
    {
        schedule: "30 0 * * *",
        timeZone: "Europe/Copenhagen",
        region: "europe-west1"
    },
    async () => {
        console.log("🕐 Scheduled task instance generation triggered");

        const today = new Date();
        const dateKey = getDateKey(today, "Europe/Copenhagen");

        try {
            const summary = await createTaskInstancesForDate({
                dateKey,
                locationId: null,
                timeZone: "Europe/Copenhagen"
            });

            console.log("✅ Scheduled generation completed successfully");
            return summary;
        } catch (error) {
            console.error("❌ Scheduled generation failed:", error);
            throw error;
        }
    }
);

/**
 * Callable function: Generate task instances manually
 * Can be called from frontend or admin tools for testing
 */
exports.generateTaskInstancesNow = onCall(
    {
        region: "europe-west1"
    },
    async (request) => {
        console.log("📞 Manual task instance generation triggered");

        const { dateKey, locationId } = request.data || {};

        if (!dateKey) {
            throw new HttpsError(
                "invalid-argument",
                "dateKey is required (format: YYYY-MM-DD)"
            );
        }

        const datePattern = /^\d{4}-\d{2}-\d{2}$/;
        if (!datePattern.test(dateKey)) {
            throw new HttpsError(
                "invalid-argument",
                "dateKey must be in YYYY-MM-DD format"
            );
        }

        try {
            const summary = await createTaskInstancesForDate({
                dateKey,
                locationId: locationId || null,
                timeZone: "Europe/Copenhagen"
            });

            console.log("✅ Manual generation completed successfully");
            return {
                success: true,
                dateKey,
                summary
            };
        } catch (error) {
            console.error("❌ Manual generation failed:", error);
            throw new HttpsError("internal", error.message);
        }
    }
);

/**
 * Callable function: Reset task instances for a specific date
 * ADMIN FUNCTION: Resets completed/failed task instances to pending
 * WARNING: This is a destructive operation - use with caution
 * TODO: Add proper admin role check when auth system is implemented
 */
exports.resetTaskInstancesForDate = onCall(
    {
        region: "europe-west1"
    },
    async (request) => {
        if (!request.auth?.uid) {
            throw new HttpsError("unauthenticated", "Authentication required");
        }

        const { dateKey, locationId } = request.data || {};

        if (!dateKey) {
            throw new HttpsError("invalid-argument", "dateKey is required");
        }

        console.log(`🔄 Starting reset for dateKey: ${dateKey}, locationId: ${locationId || "all"}`);

        try {
            if (locationId) {
                const reportId = `${locationId}__${dateKey}`;
                const reportDoc = await db.collection("daily_reports").doc(reportId).get();

                if (reportDoc.exists) {
                    throw new HttpsError(
                        "failed-precondition",
                        "Dagen er allerede lukket og kan ikke nulstilles"
                    );
                }
            }

            let instancesQuery = db.collection("task_instances")
                .where("dateKey", "==", dateKey);

            if (locationId) {
                instancesQuery = instancesQuery.where("locationId", "==", locationId);
            }

            const snapshot = await instancesQuery.get();

            if (snapshot.empty) {
                console.log("No instances found to reset");
                return {
                    success: true,
                    resetCount: 0,
                    skippedCount: 0,
                    dateKey,
                    locationId: locationId || null
                };
            }

            console.log(`Found ${snapshot.size} task instances`);

            const batch = db.batch();
            let resetCount = 0;
            let skippedCount = 0;

            snapshot.docs.forEach((doc) => {
                const data = doc.data();
                const status = data.status;

                if (status === "completed" || status === "failed") {
                    batch.update(doc.ref, {
                        status: "pending",
                        completedAt: null,
                        completedBy: null,
                        completedByName: null,
                        updatedAt: Timestamp.now(),
                        resetAt: Timestamp.now(),
                        resetBy: request.auth.uid || null,
                        resetByName: request.auth.token?.name || null,
                        resetReason: "manual_admin_reset"
                    });
                    resetCount++;
                } else {
                    skippedCount++;
                }
            });

            if (resetCount > 0) {
                await batch.commit();
                console.log(`✅ Reset ${resetCount} task instances, skipped ${skippedCount}`);
            } else {
                console.log(`No instances to reset (all ${skippedCount} were skipped)`);
            }

            return {
                success: true,
                resetCount,
                skippedCount,
                dateKey,
                locationId: locationId || null
            };
        } catch (error) {
            console.error("❌ Reset failed:", error);

            if (error.code) {
                throw error;
            }

            throw new HttpsError("internal", error.message);
        }
    }
);