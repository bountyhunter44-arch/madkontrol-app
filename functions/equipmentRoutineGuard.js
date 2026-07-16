"use strict";

/**
 * equipmentRoutineGuard.js — SINGLE SOURCE OF TRUTH.
 *
 * Equipment-bound Egenkontrol routines must NEVER be created without a concrete equipment/unit.
 * Use `shouldSkipEquipmentBoundRoutineWithoutEquipment(record)` before creating/activating:
 *   task_templates · task_instances · task_entries · routine/master cards · canonical templates.
 *
 * Process routines (nedkøling, opvarmning, 3-timers regel, modtagekontrol, adskillelse,
 * personlig hygiejne, varmholdelse, generel dokumentation) are NOT equipment-bound and must NOT be
 * skipped. Deliberately does NOT use bare "køl"/"koel" (would wrongly match nedkøling).
 */

function hasConcreteEquipmentRef(record = {}) {
  const values = [
    record.equipmentId, record.unitId, record.equipmentName, record.unitName,
    record.machineName, record.specificLabel, record.areaName, record.areaLabel,
    record.equipment && record.equipment.id, record.equipment && record.equipment.name,
    record.unit && record.unit.id, record.unit && record.unit.name
  ];
  return values.some((value) => {
    const text = String(value || "").trim();
    if (!text) return false;
    if (text === "—" || text === "-") return false;
    if (text.toLowerCase() === "ukendt") return false;
    if (text.toLowerCase() === "udstyr ikke angivet") return false;
    if (text.toLowerCase() === "default") return false;
    return true;
  });
}

function isEquipmentBoundRoutine(record = {}) {
  const haystack = [
    record.title, record.taskTitle, record.routineTitle, record.routineType,
    record.templateKey, record.templateTitle, record.category, record.subCategory, record.equipmentType
  ].filter(Boolean).join(" ").toLowerCase();

  // Process routines that are NEVER equipment-bound (must not be skipped).
  // NOTE: varmholdelse/hot_holding are PROCESS routines (the equipment variant is `varmeskab_*`,
  // matched below). Bare "køl"/"koel" is deliberately NOT used (would wrongly match nedkøling).
  const excludedProcess =
    haystack.includes("nedkøling") || haystack.includes("nedkoeling") ||
    haystack.includes("opvarmning") || haystack.includes("genopvarmning") ||
    haystack.includes("3-timers") || haystack.includes("tre_timers") || haystack.includes("tre-timers") ||
    haystack.includes("modtagekontrol") || haystack.includes("varemodtagelse") ||
    haystack.includes("adskillelse") || haystack.includes("personlig hygiejne") ||
    haystack.includes("varmholdelse") || haystack.includes("hot_holding") || haystack.includes("hot-holding");
  if (excludedProcess) return false;

  return (
    haystack.includes("køleskab") || haystack.includes("koeleskab") || haystack.includes("koleskab") || haystack.includes("fridge") ||
    haystack.includes("fryser") || haystack.includes("freezer") || haystack.includes("frost") ||
    haystack.includes("køledisk") || haystack.includes("koeledisk") || haystack.includes("koledisk") ||
    haystack.includes("kølerum") || haystack.includes("koelerum") || haystack.includes("frostrum") ||
    haystack.includes("varmeskab") ||
    haystack.includes("opvaskemaskine") || haystack.includes("dishwasher") ||
    haystack.includes("isterningemaskine") || haystack.includes("ismaskine") || haystack.includes("softice") ||
    haystack.includes("pålægsmaskine") || haystack.includes("paalaegsmaskine") || haystack.includes("palaegsmaskine") || haystack.includes("slicer") ||
    haystack.includes("komfur") || haystack.includes("stove") ||
    haystack.includes("ovn") || haystack.includes("oven") ||
    haystack.includes("friture") || haystack.includes("fryer") ||
    haystack.includes("røgeovn") || haystack.includes("roegeovn") || haystack.includes("smoke oven") ||
    haystack.includes("rasteskab") || haystack.includes("proofing")
  );
}

function shouldSkipEquipmentBoundRoutineWithoutEquipment(record = {}) {
  return isEquipmentBoundRoutine(record) && !hasConcreteEquipmentRef(record);
}

module.exports = {
  hasConcreteEquipmentRef,
  isEquipmentBoundRoutine,
  shouldSkipEquipmentBoundRoutineWithoutEquipment
};
