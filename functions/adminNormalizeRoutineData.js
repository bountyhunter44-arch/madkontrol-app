/**
 * ADMIN: Normalize Routine Data
 * 
 * Arkiverer dubletter i Firestore baseret på canonical keys.
 * Kun én aktiv instance per companyId + locationId + dateKey + routineType + unitId.
 */

const {
  normalizeRoutineType,
  resolveUnitId,
  buildCanonicalTaskKey
} = require('./canonicalRoutines');

/**
 * Normalize routine data for a location
 * 
 * @param {object} params - { db, companyId, locationId }
 * @returns {object} - { ok, instancesUpdated, instancesArchived, stats }
 */
async function adminNormalizeRoutineData({ db, companyId, locationId }) {
  console.log(`[adminNormalizeRoutineData] START for ${companyId}/${locationId}`);
  
  const instancesRef = db.collection("task_instances");
  
  const stats = {
    instancesUpdated: 0,
    instancesArchived: 0,
    dateKeys: new Set()
  };
  
  // Load all instances for this location
  const snapshot = await instancesRef
    .where("companyId", "==", companyId)
    .where("locationId", "==", locationId)
    .get();
  
  console.log(`[adminNormalizeRoutineData] Found ${snapshot.size} total instances`);
  
  const allInstances = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
  
  // Filter out already archived
  const activeInstances = allInstances.filter(inst => 
    !inst.archived && 
    !inst.skippedDuplicate && 
    inst.isActive !== false && 
    inst.active !== false
  );
  
  console.log(`[adminNormalizeRoutineData] ${activeInstances.length} active instances`);
  
  // Group by dateKey
  const byDateKey = new Map();
  activeInstances.forEach(inst => {
    const dateKey = inst.dateKey || "";
    if (!dateKey) return;
    
    if (!byDateKey.has(dateKey)) {
      byDateKey.set(dateKey, []);
    }
    byDateKey.get(dateKey).push(inst);
  });
  
  console.log(`[adminNormalizeRoutineData] Processing ${byDateKey.size} unique dates`);
  
  // Process each date
  for (const [dateKey, instances] of byDateKey.entries()) {
    console.log(`[adminNormalizeRoutineData] Processing ${dateKey}: ${instances.length} instances`);
    stats.dateKeys.add(dateKey);
    
    // Normalize routineType for all instances
    instances.forEach(inst => {
      if (!inst.routineType) {
        const candidate = inst.canonicalTaskKey || inst.templateKey || inst.taskKey || inst.controlType || inst.title || "";
        inst.routineType = normalizeRoutineType(candidate);
      }
      
      if (!inst.unitId) {
        inst.unitId = resolveUnitId(inst);
      }
      
      inst.canonicalTaskKey = buildCanonicalTaskKey(inst.routineType, inst.unitId);
    });
    
    // Group by canonical key
    const byCanonicalKey = new Map();
    const duplicates = [];
    
    instances.forEach(inst => {
      const dedupeKey = `${companyId}__${locationId}__${dateKey}__${inst.routineType}__${inst.unitId}`;
      
      if (byCanonicalKey.has(dedupeKey)) {
        // Duplicate found - determine keeper
        const existing = byCanonicalKey.get(dedupeKey);
        
        // Keeper priority:
        // 1. Has routineType field
        // 2. Has canonicalTaskKey field
        // 3. Not legacy/minimal
        // 4. Newest updatedAt/createdAt
        
        const existingScore = (
          (existing.routineType ? 1000 : 0) +
          (existing.canonicalTaskKey ? 500 : 0) +
          (existing.templateKey?.includes('minimal') || existing.taskKey?.includes('minimal') ? -200 : 0) +
          (existing.updatedAt?.toMillis?.() || existing.createdAt?.toMillis?.() || 0)
        );
        
        const instScore = (
          (inst.routineType ? 1000 : 0) +
          (inst.canonicalTaskKey ? 500 : 0) +
          (inst.templateKey?.includes('minimal') || inst.taskKey?.includes('minimal') ? -200 : 0) +
          (inst.updatedAt?.toMillis?.() || inst.createdAt?.toMillis?.() || 0)
        );
        
        if (instScore > existingScore) {
          // New instance is better - mark existing as duplicate
          duplicates.push({ instance: existing, keeperId: inst.id });
          byCanonicalKey.set(dedupeKey, inst);
        } else {
          // Existing is better - mark new instance as duplicate
          duplicates.push({ instance: inst, keeperId: existing.id });
        }
      } else {
        byCanonicalKey.set(dedupeKey, inst);
      }
    });
    
    console.log(`[adminNormalizeRoutineData] ${dateKey}: ${byCanonicalKey.size} unique, ${duplicates.length} duplicates`);
    
    // Archive duplicates in Firestore
    for (const { instance, keeperId } of duplicates) {
      await instancesRef.doc(instance.id).update({
        archived: true,
        archivedReason: "duplicate_canonical_key",
        archivedAt: new Date(),
        isActive: false,
        active: false,
        skippedDuplicate: true,
        duplicateOf: keeperId,
        updatedAt: new Date()
      });
      stats.instancesArchived++;
      console.log(`[adminNormalizeRoutineData] Archived duplicate: ${instance.id} (keeper: ${keeperId})`);
    }
    
    // Update keepers with canonical fields
    for (const keeper of byCanonicalKey.values()) {
      await instancesRef.doc(keeper.id).update({
        routineType: keeper.routineType,
        unitId: keeper.unitId,
        canonicalTaskKey: keeper.canonicalTaskKey,
        updatedAt: new Date()
      });
      stats.instancesUpdated++;
    }
  }
  
  console.log(`[adminNormalizeRoutineData] COMPLETE:`, stats);
  
  return {
    ok: true,
    companyId,
    locationId,
    instancesUpdated: stats.instancesUpdated,
    instancesArchived: stats.instancesArchived,
    dateKeysProcessed: stats.dateKeys.size
  };
}

module.exports = {
  adminNormalizeRoutineData
};
