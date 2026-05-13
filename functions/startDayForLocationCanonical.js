/**
 * CANONICAL START DAY FOR LOCATION
 * 
 * Strict canonical-only implementation.
 * NO fallbacks, NO legacy routines, NO minimal_ templates.
 * 
 * Flow:
 * 1. Check if templates exist
 * 2. If no templates and isDemo: create canonical templates
 * 3. Use canonical engine to generate instances
 * 4. Return stats
 */

const {
  generateCanonicalTaskTemplates,
  startDayForLocationCanonical
} = require('./canonicalTaskEngine');

/**
 * Start day for location using canonical engine
 * 
 * @param {object} params - { db, companyId, locationId, dateKey, userId }
 * @returns {object} - { ok, created, updated, skipped, ensured, templatesCount, message }
 */
async function startDayForLocationStrict({
  db,
  companyId,
  locationId,
  dateKey,
  userId = "system"
}) {
  console.log(`[startDayForLocationStrict] START for ${companyId}/${locationId}/${dateKey}`);
  
  const stats = {
    ok: true,
    created: 0,
    updated: 0,
    skipped: 0,
    ensured: 0,
    templatesCount: 0,
    message: ""
  };
  
  // Check if templates exist
  const templatesSnap = await db.collection("task_templates")
    .where("companyId", "==", companyId)
    .where("locationId", "==", locationId)
    .where("archived", "!=", true)
    .get();
  
  let templateCount = templatesSnap.docs.filter(doc => {
    const data = doc.data();
    return data.isActive !== false && data.active !== false;
  }).length;
  
  console.log(`[startDayForLocationStrict] Found ${templateCount} active templates`);
  
  // If no templates exist, check if this is a demo and create canonical templates
  if (templateCount === 0) {
    console.warn("[startDayForLocationStrict] No templates found");
    
    // Check if demo company
    const companySnap = await db.collection("companies").doc(companyId).get();
    const companyData = companySnap.data() || {};
    const isDemo = companyData.isDemo === true || companyData.demoMode === true;
    
    if (isDemo) {
      console.log("[startDayForLocationStrict] Demo company detected - creating canonical templates");
      
      try {
        // Generate canonical templates
        const templateStats = await generateCanonicalTaskTemplates({
          db,
          companyId,
          locationId
        });
        
        templateCount = templateStats.created + templateStats.updated;
        
        console.log("[startDayForLocationStrict] Created canonical templates:", templateStats);
      } catch (err) {
        console.error("[startDayForLocationStrict] Failed to create canonical templates:", err);
        return {
          ok: false,
          created: 0,
          updated: 0,
          skipped: 0,
          ensured: 0,
          templatesCount: 0,
          message: "Kunne ikke oprette templates: " + err.message
        };
      }
    } else {
      return {
        ok: false,
        created: 0,
        updated: 0,
        skipped: 0,
        ensured: 0,
        templatesCount: 0,
        message: "Ingen templates fundet. Opret templates først."
      };
    }
  }
  
  // Generate instances using canonical engine
  try {
    const instanceStats = await startDayForLocationCanonical({
      db,
      companyId,
      locationId,
      dateKey,
      createdBy: userId
    });
    
    stats.created = instanceStats.instancesCreated || 0;
    stats.updated = instanceStats.instancesUpdated || 0;
    stats.ensured = stats.created + stats.updated;
    stats.templatesCount = templateCount;
    
    // WARNING: If we have templates but created 0 instances
    if (templateCount > 0 && stats.ensured === 0) {
      console.error("[startDayForLocationStrict] WARNING: Had templates but created 0 instances!");
      console.error("[startDayForLocationStrict] This indicates a problem with instance generation");
    }
    
    stats.message = stats.created > 0
      ? `Oprettet ${stats.created} nye rutiner`
      : `Dagens rutiner er klar (${stats.ensured} total)`;
    
    console.log("[startDayForLocationStrict] RESULT:", stats);
    
    return stats;
    
  } catch (err) {
    console.error("[startDayForLocationStrict] Failed to generate instances:", err);
    return {
      ok: false,
      created: 0,
      updated: 0,
      skipped: 0,
      ensured: 0,
      templatesCount: templateCount,
      message: "Kunne ikke oprette rutiner: " + err.message
    };
  }
}

module.exports = {
  startDayForLocationStrict
};
