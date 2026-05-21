/**
 * CANONICAL TASK ENGINE
 * 
 * Core engine for canonical routine management.
 * Ensures single task instance per companyId + locationId + dateKey + routineType + unitId.
 * 
 * Key functions:
 * - generateCanonicalTaskTemplates: Creates/updates templates from canonical model
 * - ensureSingleTaskInstance: Hard dedupe - only one instance per unique key
 * - startDayForLocation: Generates daily instances with dedupe
 */

const {
  CANONICAL_ROUTINES,
  normalizeRoutineType,
  buildCanonicalTaskKey,
  buildDisplayTitle,
  buildCanonicalRoutineFields
} = require('./js/canonicalRoutines');

/**
 * Derive controlType from routineType
 * @param {string} routineType
 * @returns {string} controlType
 */
function deriveControlType(routineType) {
  if (!routineType) return 'simple_yes_no';
  
  const rt = routineType.toLowerCase();
  
  // Temperature controls
  if (rt.includes('_temperatur') || rt.includes('temperatur_')) {
    return 'temperature';
  }
  
  // Cleaning controls
  if (rt.includes('_rengoering') || rt.includes('rengoering_')) {
    return 'cleaning';
  }
  
  // Specific mappings
  if (rt === 'varemodtagelse') return 'receiving';
  if (rt === 'nedkoeling') return 'cooling';
  if (rt === 'opvarmning') return 'heating';
  if (rt === 'varmholdelse') return 'hot_holding';
  if (rt === 'opvaskemaskine_skyllevand') return 'dishwasher';
  if (rt === 'tre_timers_regel') return 'simple_yes_no';
  if (rt === 'adskillelse') return 'simple_yes_no';
  if (rt === 'koekken_rengoering') return 'cleaning';
  if (rt === 'personlig_hygiejne') return 'simple_yes_no';
  if (rt === 'rengoering') return 'cleaning';
  if (rt === 'aarlig_revision') return 'simple_yes_no';
  if (rt === 'sporbarhed') return 'simple_yes_no';
  if (rt === 'tilbagetraekning') return 'simple_yes_no';
  if (rt === 'opbevaring') return 'simple_yes_no';
  if (rt === 'allergener') return 'simple_yes_no';
  if (rt === 'udstyr_vedligeholdelse') return 'simple_yes_no';
  
  // Default
  return 'simple_yes_no';
}

/**
 * Generate canonical task templates for a location
 * 
 * Creates one template per routineType (not per unit).
 * Templates are unit-agnostic - instances are unit-specific.
 * 
 * @param {object} params - { db, companyId, locationId, routineKeys? }
 * @returns {object} - { created, updated, archived, skipped }
 */
async function generateCanonicalTaskTemplates({ db, companyId, locationId, routineKeys = null }) {
  console.log(`[generateCanonicalTaskTemplates] START for ${companyId}/${locationId}`, {
    filterMode: routineKeys ? 'FILTERED' : 'ALL',
    routineKeysCount: routineKeys ? routineKeys.length : 'N/A'
  });
  
  const templatesRef = db.collection("task_templates");
  const todayDateKey = new Date().toISOString().slice(0, 10);
  
  const stats = {
    created: 0,
    updated: 0,
    archived: 0,
    skipped: 0
  };
  
  // Load existing templates for this location
  const existingSnap = await templatesRef
    .where("companyId", "==", companyId)
    .where("locationId", "==", locationId)
    .get();
  
  // Group by routineType to find duplicates
  const existingByRoutineType = new Map();
  const duplicates = [];
  
  existingSnap.docs.forEach(doc => {
    const data = doc.data();
    
    // Try to extract routineType from various fields
    const routineType = normalizeRoutineType(
      data.routineType ||
      data.templateKey ||
      data.taskKey ||
      data.key ||
      data.controlType ||
      data.title ||
      ""
    );
    
    if (!routineType) {
      console.warn(`[generateCanonicalTaskTemplates] Could not determine routineType for template ${doc.id}`);
      return;
    }
    
    // Check if this routineType already exists
    if (existingByRoutineType.has(routineType)) {
      // Duplicate found
      duplicates.push({ id: doc.id, data, routineType });
    } else {
      existingByRoutineType.set(routineType, { id: doc.id, data });
    }
  });
  
  console.log(`[generateCanonicalTaskTemplates] Found ${existingByRoutineType.size} unique routineTypes, ${duplicates.length} duplicates`);
  
  // Archive duplicates
  for (const dup of duplicates) {
    const reason = "duplicate_routine_type";
    
    await templatesRef.doc(dup.id).update({
      archived: true,
      archivedReason: reason,
      archivedAt: new Date(),
      isActive: false,
      active: false,
      skippedDuplicate: true,
      updatedAt: new Date()
    });
    stats.archived++;
    console.log(`[generateCanonicalTaskTemplates] Archived duplicate: ${dup.id} (routineType: ${dup.routineType})`);
  }
  
  // Filter routines if routineKeys provided (quick onboarding mode)
  const routinesToGenerate = routineKeys
    ? CANONICAL_ROUTINES.filter(def => routineKeys.includes(def.routineType))
    : CANONICAL_ROUTINES;
  
  console.log(`[generateCanonicalTaskTemplates] Generating ${routinesToGenerate.length} templates (total available: ${CANONICAL_ROUTINES.length})`);
  
  // Generate/update canonical templates
  for (const definition of routinesToGenerate) {
    const routineType = definition.routineType;
    const templateId = `${companyId}__${locationId}__canonical__${routineType}`;
    const existing = existingByRoutineType.get(routineType);
    
    // Derive controlType from routineType
    const controlType = deriveControlType(routineType);
    
    const templatePayload = {
      templateId,
      companyId,
      locationId,
      
      // Canonical fields
      routineType,
      canonicalTaskKey: routineType, // Template key is just routineType (no unitId)
      title: definition.displayTitle,
      displayTitle: definition.displayTitle,
      longDescription: definition.longDescription,
      subtitle: definition.subtitle || "",
      purpose: definition.purpose || "",
      checkItems: definition.checkItems || [],
      checklistItems: definition.checklistItems || [],
      controlCheckpoints: definition.controlCheckpoints || [],
      howToCheck: definition.howToCheck || "",
      acceptCriteria: definition.acceptCriteria || "",
      documentation: definition.documentation || "",
      standardDeviationTexts: definition.standardDeviationTexts || [],
      standardCorrectiveActions: definition.standardCorrectiveActions || [],
      group: definition.group,
      category: controlType === "cleaning" ? "cleaning" : definition.group,
      controlType,
      
      // Frequency
      frequencyType: "interval_days",
      frequencyDays: definition.frequencyDays,
      interval_days: definition.frequencyDays,
      
      // Schedule config
      scheduleConfig: {
        scheduleType: "recurring",
        recurrenceMode: "interval_days",
        recurrenceValue: definition.frequencyDays,
        anchorDate: todayDateKey
      },
      
      // Risk data
      risk: definition.risk,
      
      // Metadata
      templateType: "operational",
      templateSource: "canonical_routine",
      isActive: true,
      isCCP: definition.group === "CCP",
      
      // Legacy compatibility
      templateKey: routineType,
      taskKey: routineType,
      description: definition.longDescription,
      
      updatedAt: new Date()
    };
    
    if (existing) {
      // Update existing template with canonical data
      await templatesRef.doc(existing.id).update(templatePayload);
      stats.updated++;
      console.log(`[generateCanonicalTaskTemplates] Updated: ${routineType} (${definition.displayTitle})`);
    } else {
      // Create new template
      templatePayload.createdAt = new Date();
      await templatesRef.doc(templateId).set(templatePayload);
      stats.created++;
      console.log(`[generateCanonicalTaskTemplates] Created: ${routineType} (${definition.displayTitle})`);
    }
  }
  
  console.log(`[generateCanonicalTaskTemplates] COMPLETE:`, stats);
  return stats;
}

/**
 * Ensure single task instance
 * 
 * Hard dedupe: Only one instance per companyId + locationId + dateKey + routineType + unitId
 * 
 * @param {object} params - { db, companyId, locationId, dateKey, routineType, unitId, unitName, templateId, createdBy }
 * @returns {object} - { instanceId, created, updated, archived }
 */
async function ensureSingleTaskInstance({
  db,
  companyId,
  organizationId = "",
  locationId,
  dateKey,
  routineType,
  unitId = "default",
  unitName = "",
  unitType = "",
  templateId = "",
  createdBy = "system"
}) {
  const instancesRef = db.collection("task_instances");
  
  // STRICT: Normalize and validate routineType
  const normalizedRoutineType = normalizeRoutineType(routineType);
  if (!normalizedRoutineType) {
    console.warn(`[ensureSingleTaskInstance] Invalid routineType: ${routineType} - SKIPPING`);
    return { instanceId: null, created: false, updated: false, archived: 0, skipped: true };
  }
  
  // Get routine definition
  const definition = CANONICAL_ROUTINES.find(r => r.routineType === normalizedRoutineType);
  if (!definition) {
    console.warn(`[ensureSingleTaskInstance] No definition for routineType: ${normalizedRoutineType} - SKIPPING`);
    return { instanceId: null, created: false, updated: false, archived: 0, skipped: true };
  }
  
  // Build canonical key
  const canonicalTaskKey = buildCanonicalTaskKey(normalizedRoutineType, unitId);
  const instanceId = `${companyId}__${locationId}__${dateKey}__${canonicalTaskKey}`;
  
  console.log(`[ensureSingleTaskInstance] Checking: ${instanceId}`);
  
  // Check if instance already exists
  const existingSnap = await instancesRef.doc(instanceId).get();
  
  if (existingSnap.exists) {
    const existingData = existingSnap.data();
    
    // Check if it's archived or inactive
    if (existingData.archived || existingData.skippedDuplicate || !existingData.isActive) {
      console.log(`[ensureSingleTaskInstance] Reactivating archived instance: ${instanceId}`);
      
      await instancesRef.doc(instanceId).update({
        archived: false,
        skippedDuplicate: false,
        isActive: true,
        active: true,
        updatedAt: new Date()
      });
      
      return { instanceId, created: false, updated: true, archived: 0 };
    }
    
    console.log(`[ensureSingleTaskInstance] Instance already exists: ${instanceId}`);
    return { instanceId, created: false, updated: false, archived: 0 };
  }
  
  // Find any duplicates with same key
  const duplicatesSnap = await instancesRef
    .where("companyId", "==", companyId)
    .where("locationId", "==", locationId)
    .where("dateKey", "==", dateKey)
    .where("canonicalTaskKey", "==", canonicalTaskKey)
    .get();
  
  let archivedCount = 0;
  
  // Archive all duplicates
  for (const dupDoc of duplicatesSnap.docs) {
    if (dupDoc.id === instanceId) continue; // Skip the one we're about to create
    
    await instancesRef.doc(dupDoc.id).update({
      archived: true,
      archivedReason: "duplicate_canonical_key",
      archivedAt: new Date(),
      isActive: false,
      active: false,
      skippedDuplicate: true,
      duplicateOf: instanceId,
      updatedAt: new Date()
    });
    archivedCount++;
    console.log(`[ensureSingleTaskInstance] Archived duplicate: ${dupDoc.id}`);
  }
  
  // Create new instance
  const instancePayload = {
    // IDs
    instanceId,
    companyId,
    organizationId: organizationId || companyId,
    locationId,
    dateKey,
    templateId: templateId || `${companyId}__${locationId}__canonical__${normalizedRoutineType}`,
    
    // Canonical fields
    routineType: normalizedRoutineType,
    templateKey: normalizedRoutineType,
    taskKey: normalizedRoutineType,
    name: definition.displayTitle,
    unitId,
    unitName,
    equipmentId: unitId !== "default" ? unitId : "",
    equipmentName: unitId !== "default" ? unitName : "",
    equipmentType: unitId !== "default" ? unitType : "",
    canonicalTaskKey,
    controlType: deriveControlType(normalizedRoutineType),
    
    // Display
    title: definition.displayTitle,
    displayTitle: buildDisplayTitle(normalizedRoutineType, unitId, unitName),
    longDescription: definition.longDescription,
    subtitle: definition.subtitle || "",
    purpose: definition.purpose || "",
    checkItems: definition.checkItems || [],
    checklistItems: definition.checklistItems || [],
    controlCheckpoints: definition.controlCheckpoints || [],
    howToCheck: definition.howToCheck || "",
    acceptCriteria: definition.acceptCriteria || "",
    documentation: definition.documentation || "",
    standardDeviationTexts: definition.standardDeviationTexts || [],
    standardCorrectiveActions: definition.standardCorrectiveActions || [],
    
    // Classification
    group: definition.group,
    category: deriveControlType(normalizedRoutineType) === "cleaning" ? "cleaning" : definition.group,
    isCCP: definition.group === "CCP",
    
    // Frequency
    frequencyDays: definition.frequencyDays,
    frequencyType: "interval_days",
    interval_days: definition.frequencyDays,
    scheduleConfig: {
      scheduleType: "recurring",
      recurrenceMode: "interval_days",
      recurrenceValue: definition.frequencyDays,
      anchorDate: dateKey
    },
    
    // Risk
    risk: definition.risk,
    
    // Status
    status: "pending",
    isActive: true,
    active: true,
    archived: false,
    
    // Metadata
    createdBy,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  await instancesRef.doc(instanceId).set(instancePayload);
  console.log(`[ensureSingleTaskInstance] Created: ${instanceId}`);
  
  return { instanceId, created: true, updated: false, archived: archivedCount };
}

/**
 * Start day for location
 * 
 * Generates task instances for today based on canonical templates and equipment.
 * Ensures no duplicates via ensureSingleTaskInstance.
 * 
 * @param {object} params - { db, companyId, locationId, dateKey, createdBy, routineKeys? }
 * @returns {object} - { ok, instancesCreated, instancesUpdated, instancesArchived }
 */
async function startDayForLocationCanonical({
  db,
  companyId,
  locationId,
  dateKey,
  createdBy = "system",
  routineKeys = null
}) {
  console.log(`[startDayForLocationCanonical] START for ${companyId}/${locationId}/${dateKey}`, {
    filterMode: routineKeys ? 'FILTERED' : 'ALL',
    routineKeysCount: routineKeys ? routineKeys.length : 'N/A'
  });
  
  const stats = {
    ok: true,
    instancesCreated: 0,
    instancesUpdated: 0,
    instancesArchived: 0
  };
  
  // Load equipment units
  const equipmentSnap = await db.collection("equipment")
    .where("companyId", "==", companyId)
    .where("locationId", "==", locationId)
    .get();
  
  const units = [];
  equipmentSnap.docs.forEach(doc => {
    const data = doc.data();
    if (data.archived || !data.isActive) return;

    const type = normalizeRoutineType(data.type || data.equipmentType || "") || String(data.type || data.equipmentType || "").toLowerCase().trim();
    const category = normalizeRoutineType(data.category || "") || String(data.category || "").toLowerCase().trim();
    
    units.push({
      id: data.id || doc.id,
      name: data.name || data.equipmentName || "",
      type,
      category
    });
  });
  
  console.log(`[startDayForLocationCanonical] Found ${units.length} active equipment units`);
  
  // Filter routines if routineKeys provided (quick onboarding mode)
  const routinesToGenerate = routineKeys
    ? CANONICAL_ROUTINES.filter(def => routineKeys.includes(def.routineType))
    : CANONICAL_ROUTINES;
  
  console.log(`[startDayForLocationCanonical] Generating instances for ${routinesToGenerate.length} routines (total available: ${CANONICAL_ROUTINES.length})`);
  
  // Generate instances for each routine type
  for (const definition of routinesToGenerate) {
    const routineType = definition.routineType;
    
    // Check if this routine should run today based on frequency
    // For now, we generate all routines - frequency check can be added later
    
    // Determine which units this routine applies to
    let targetUnits = [];
    
    if (routineType === "koeleskab_temperatur" || routineType === "koeleskab_rengoering") {
      // Fridge routines
      targetUnits = units.filter(u => 
        u.type === "fridge" || 
        u.type === "koeleskab" ||
        u.category === "fridge"
      );
    } else if (routineType === "fryser_temperatur" || routineType === "fryser_rengoering") {
      // Freezer routines
      targetUnits = units.filter(u => 
        u.type === "freezer" || 
        u.type === "fryser" ||
        u.category === "freezer"
      );
    } else if (routineType === "walkin_koeler_temperatur" || routineType === "walkin_koeler_rengoering") {
      // Walk-in cooler routines
      targetUnits = units.filter(u => 
        u.type === "walk_in_cooler" || 
        u.type === "walkin_koeler" ||
        u.category === "walk_in_cooler"
      );
    } else if (routineType === "walkin_fryser_temperatur" || routineType === "walkin_fryser_rengoering") {
      // Walk-in freezer routines
      targetUnits = units.filter(u => 
        u.type === "walk_in_freezer" || 
        u.type === "walkin_fryser" ||
        u.category === "walk_in_freezer"
      );
    } else if (routineType === "opvaskemaskine_skyllevand") {
      // Dishwasher routines
      targetUnits = units.filter(u => 
        u.type === "dishwasher" || 
        u.type === "opvaskemaskine" ||
        u.category === "dishwasher"
      );
    } else if (routineType === "friture_rengoering") {
      // Fryer routines
      targetUnits = units.filter(u => 
        u.type === "fryer" || 
        u.type === "friture" ||
        u.category === "fryer"
      );
    } else if (routineType === "softicemaskine_rengoering" || routineType === "softicemaskine_temperatur" || routineType === "softice_maskine_rengoering" || routineType === "softice_temperatur_kontrol") {
      // Softice machine routines
      targetUnits = units.filter(u => 
        u.type === "softice_machine" || 
        u.type === "softice_maskine" ||
        u.category === "softice_machine"
      );
    } else if (routineType === "ismaskine_rengoering" || routineType === "ismaskine_temperatur") {
      // Ice machine routines
      targetUnits = units.filter(u =>
        u.type === "ice_machine" ||
        u.type === "ismaskine" ||
        u.category === "ice_machine" ||
        u.category === "ismaskine"
      );
    } else if (routineType === "koledisk_temperatur" || routineType === "koledisk_rengoering") {
      // Refrigerated display routines
      targetUnits = units.filter(u => 
        u.type === "refrigerated_display" || 
        u.type === "koledisk" ||
        u.category === "refrigerated_display"
      );
    } else if (routineType === "ovn_rengoering") {
      // Oven routines
      targetUnits = units.filter(u => 
        u.type === "oven" || 
        u.type === "ovn" ||
        u.category === "oven"
      );
    } else if (routineType === "komfur_rengoering") {
      // Stove routines
      targetUnits = units.filter(u => 
        u.type === "stove" || 
        u.type === "komfur" ||
        u.category === "stove"
      );
    } else if (routineType === "blaesekoeler_temperatur" || routineType === "blaesekoeler_rengoering") {
      // Blast chiller routines
      targetUnits = units.filter(u => 
        u.type === "blast_chiller" || 
        u.type === "blaesekoeler" ||
        u.category === "blast_chiller"
      );
    } else if (routineType === "varmeskab_temperatur" || routineType === "varmeskab_rengoering") {
      // Hot cabinet routines
      targetUnits = units.filter(u => 
        u.type === "hot_cabinet" || 
        u.type === "varmeskab" ||
        u.category === "hot_cabinet"
      );
    } else if (routineType === "roegeovn_temperatur" || routineType === "roegeovn_rengoering") {
      // Smoke oven routines
      targetUnits = units.filter(u => 
        u.type === "smoke_oven" || 
        u.type === "roegeovn" ||
        u.category === "smoke_oven"
      );
    } else if (routineType === "rasteskab_rengoering") {
      // Proofing cabinet routines
      targetUnits = units.filter(u => 
        u.type === "proofing_cabinet" || 
        u.type === "rasteskab" ||
        u.category === "proofing_cabinet"
      );
    } else if (routineType === "paalaegsmaskine_rengoering") {
      // Slicer routines
      targetUnits = units.filter(u => 
        u.type === "slicer" || 
        u.type === "paalaegsmaskine" ||
        u.type === "slicing_machine" ||
        u.category === "slicer" ||
        u.category === "paalaegsmaskine" ||
        u.category === "slicing_machine"
      );
    } else if (routineType === "opvaskemaskine_rengoering") {
      // Dishwasher cleaning routines (separate from temperature check)
      targetUnits = units.filter(u => 
        u.type === "dishwasher" || 
        u.type === "opvaskemaskine" ||
        u.category === "dishwasher"
      );
    } else {
      // Non-equipment routines (use default unit)
      targetUnits = [{ id: "default", name: "", type: "default" }];
    }
    
    // If no units found for equipment-based routine, skip
    if (targetUnits.length === 0) {
      console.log(`[startDayForLocationCanonical] No units found for ${routineType}, skipping`);
      continue;
    }
    
    // Create instance for each target unit
    for (const unit of targetUnits) {
      try {
        const result = await ensureSingleTaskInstance({
          db,
          companyId,
          organizationId: companyId,
          locationId,
          dateKey,
          routineType,
          unitId: unit.id,
          unitName: unit.name,
          unitType: unit.type,
          templateId: `${companyId}__${locationId}__canonical__${routineType}`,
          createdBy
        });
        
        if (result.created) stats.instancesCreated++;
        if (result.updated) stats.instancesUpdated++;
        stats.instancesArchived += result.archived;
        
      } catch (err) {
        console.error(`[startDayForLocationCanonical] Failed to create instance for ${routineType}/${unit.id}:`, err);
      }
    }
  }
  
  console.log(`[startDayForLocationCanonical] COMPLETE:`, stats);
  return stats;
}

module.exports = {
  generateCanonicalTaskTemplates,
  ensureSingleTaskInstance,
  startDayForLocationCanonical
};
