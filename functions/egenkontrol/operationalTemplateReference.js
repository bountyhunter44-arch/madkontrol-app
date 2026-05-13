// === COPILOT REFERENCE FILE ===
// This file defines the correct pattern for operational task templates
// Copilot should follow this structure across the project

// RULES:
// - ONLY operational tasks
// - NEVER schema.titleKey or descriptionKey
// - NO GAG / CCP / compliance logic
// - ALWAYS use guideKey
// - ALWAYS return Firestore-ready objects

const admin = require("firebase-admin");

// === AI RULES ===
// Read functions/egenkontrol/operationalTemplateReference.js first
// Use it as source of truth
// Only generate operational templates
// Never use schema.titleKey or descriptionKey
// No GAG / CCP / compliance logic
// Always use guideKey
// =================

/**
 * Create operational task template
 * @param {Object} params
 * @param {string} params.companyId
 * @param {string} params.locationId
 * @param {string} params.templateKey
 * @param {string} params.title
 * @param {string} params.guideKey
 * @param {string} [params.suffix]
 */
function createTaskTemplate({
  companyId,
  locationId,
  templateKey,
  title,
  guideKey,
  suffix = "base"
}) {
  const templateId = `${companyId}__${locationId}__${templateKey}__${suffix}`.slice(0, 120);

  return {
    templateId,
    companyId,
    locationId,
    templateKey,
    type: "operational",
    title,
    guideKey,
    isActive: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  };
}

/**
 * Map unit type to guideKey
 */
function getGuideKeyFromUnit(unit) {
  if (!unit) return null;

  if (unit.type === "fridge") return "fridge_temperature";
  if (unit.type === "freezer") return "freezer_temperature";
  if (unit.type === "walkin") return "walkin_cooler_temperature";

  return null;
}

/**
 * Generate temperature templates (per unit)
 */
function generateTemperatureTemplates({ companyId, locationId, units }) {
  return units
    .map((unit) => {
      const guideKey = getGuideKeyFromUnit(unit);
      if (!guideKey) return null;

      return createTaskTemplate({
        companyId,
        locationId,
        templateKey: "temperature_control",
        title: `Temperaturkontrol – ${unit.name}`,
        guideKey,
        suffix: unit.id
      });
    })
    .filter(Boolean);
}

/**
 * Generate standard operational templates
 */
function generateOperationalTemplates({ companyId, locationId, processFlags }) {
  const templates = [];

  // VAREMODTAGELSE
  templates.push(
    createTaskTemplate({
      companyId,
      locationId,
      templateKey: "receiving_goods",
      title: "Varemodtagelse af fødevarer",
      guideKey: "receiving_goods"
    })
  );

  // RENGØRING
  templates.push(
    createTaskTemplate({
      companyId,
      locationId,
      templateKey: "cleaning_surfaces",
      title: "Rengøringskontrol – Overflader",
      guideKey: "cleaning_control"
    })
  );

  templates.push(
    createTaskTemplate({
      companyId,
      locationId,
      templateKey: "cleaning_equipment",
      title: "Rengøringskontrol – Udstyr",
      guideKey: "cleaning_control"
    })
  );

  // OPBEVARING / ADSKILLELSE
  templates.push(
    createTaskTemplate({
      companyId,
      locationId,
      templateKey: "storage_separation",
      title: "Kontrol af opbevaring og adskillelse",
      guideKey: "cold_storage_placement"
    })
  );

  // TILBEREDNING
  if (processFlags?.cooking) {
    templates.push(
      createTaskTemplate({
        companyId,
        locationId,
        templateKey: "hot_preparation",
        title: "Kontrol af tilberedning",
        guideKey: "hot_preparation_core_temperature"
      })
    );
  }

  // NEDKØLING
  if (processFlags?.cooling) {
    templates.push(
      createTaskTemplate({
        companyId,
        locationId,
        templateKey: "cooling_control",
        title: "Nedkøling af fødevarer",
        guideKey: "cooling_control"
      })
    );
  }

  // VARMHOLDNING
  if (processFlags?.hotHolding) {
    templates.push(
      createTaskTemplate({
        companyId,
        locationId,
        templateKey: "hot_holding",
        title: "Varmholdelse",
        guideKey: "hot_holding"
      })
    );
  }

  // OPVASK
  templates.push(
    createTaskTemplate({
      companyId,
      locationId,
      templateKey: "dishwasher_control",
      title: "Kontrol af opvaskemaskine",
      guideKey: "dishwasher_control"
    })
  );

  return templates;
}

module.exports = {
  createTaskTemplate,
  generateTemperatureTemplates,
  generateOperationalTemplates
};