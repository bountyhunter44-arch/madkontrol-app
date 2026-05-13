const { businessTypes } = require("../registries/businessTypes");
const { areaTypes } = require("../registries/areaTypes");
const { equipmentTypes } = require("../registries/equipmentTypes");
const { activityTypes } = require("../registries/activityTypes");
const { controlLibrary } = require("../libraries/controlLibrary");
const { normalizeOnboardingProfile, unique } = require("../utils/registryHelpers");

function buildTemplateId(controlKey, targetType, targetKey) {
  return `template_${controlKey}__${targetType}__${targetKey}`;
}

function buildEffectiveProfile(rawProfile = {}) {
  const profile = normalizeOnboardingProfile(rawProfile);
  const business = businessTypes[profile.businessType] || null;

  return {
    businessType: profile.businessType,
    areaTypes: unique([...(business?.defaultAreaTypes || []), ...profile.areaTypes]),
    equipmentTypes: unique([...(business?.defaultEquipmentTypes || []), ...profile.equipmentTypes]),
    activityTypes: unique([...(business?.defaultActivities || []), ...profile.activityTypes]),
    riskTags: unique([...(business?.defaultRiskTags || []), ...profile.riskTags])
  };
}

function buildTemplatesFromProfile(rawProfile = {}) {
  const profile = buildEffectiveProfile(rawProfile);
  const templates = [];

  for (const control of Object.values(controlLibrary)) {
    // Validate required fields
    if (!control.guideKey) {
      console.error(`❌ Control missing guideKey: ${control.controlKey}`);
      continue;
    }

    if (control.scope === "equipment") {
      for (const equipmentKey of profile.equipmentTypes) {
        const equipment = equipmentTypes[equipmentKey];
        if (!equipment) continue;

        const variant = Object.values(control.variants || {}).find((entry) =>
          (entry.appliesTo || []).includes(equipmentKey)
        );

        if (!variant) continue;

        // Deterministic mapping: controlType = guideKey
        const controlType = control.guideKey;

        templates.push({
          templateId: buildTemplateId(control.controlKey, "equipment", equipmentKey),
          controlKey: control.controlKey,
          guideKey: control.guideKey,
          controlType: controlType,
          scope: "equipment",
          targetKey: equipmentKey,
          targetLabel: equipment.label,
          frequency: control.defaultFrequency,
          taskType: control.taskType,
          evidence: control.evidence || null,
          measurementConfig: control.measurementConfig || null,
          limits: variant.limits || null,
          checkpoints: variant.checkpoints || [],
          checklist: variant.checklist || []
        });
      }
    }

    if (control.scope === "area") {
      for (const areaKey of profile.areaTypes) {
        const area = areaTypes[areaKey];
        if (!area) continue;

        const variant = Object.values(control.variants || {}).find((entry) =>
          (entry.appliesTo || []).includes(areaKey)
        );

        if (!variant) continue;

        // Deterministic mapping: controlType = guideKey
        const controlType = control.guideKey;

        templates.push({
          templateId: buildTemplateId(control.controlKey, "area", areaKey),
          controlKey: control.controlKey,
          guideKey: control.guideKey,
          controlType: controlType,
          scope: "area",
          targetKey: areaKey,
          targetLabel: area.label,
          frequency: control.defaultFrequency,
          taskType: control.taskType,
          evidence: control.evidence || null,
          measurementConfig: control.measurementConfig || null,
          limits: variant.limits || null,
          checkpoints: variant.checkpoints || [],
          checklist: variant.checklist || []
        });
      }
    }

    if (control.scope === "activity") {
      for (const activityKey of profile.activityTypes) {
        const activity = activityTypes[activityKey];
        if (!activity) continue;

        const variant = Object.values(control.variants || {}).find((entry) =>
          (entry.appliesTo || []).includes(activityKey)
        );

        if (!variant) continue;

        // Deterministic mapping: controlType = guideKey
        const controlType = control.guideKey;

        templates.push({
          templateId: buildTemplateId(control.controlKey, "activity", activityKey),
          controlKey: control.controlKey,
          guideKey: control.guideKey,
          controlType: controlType,
          scope: "activity",
          targetKey: activityKey,
          targetLabel: activity.label,
          frequency: control.defaultFrequency,
          taskType: control.taskType,
          evidence: control.evidence || null,
          measurementConfig: control.measurementConfig || null,
          limits: variant.limits || null,
          checkpoints: variant.checkpoints || [],
          checklist: variant.checklist || []
        });
      }
    }
  }

  return {
    profile,
    templates
  };
}

module.exports = {
  buildEffectiveProfile,
  buildTemplatesFromProfile
};
