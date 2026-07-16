/**
 * riskToRoutineTransformer.js
 * 
 * Transformation layer: riskCards → routineTemplates
 * 
 * Parses the `controls` field from risk analysis cards and generates
 * concrete routine templates that can be used for task generation.
 * 
 * NO refactoring of existing data models.
 * NO invention of new control points.
 * ONLY maps values that actually exist in the controls field.
 */

/**
 * Build routine cards from risk analysis cards.
 * 
 * @param {Array} riskCards - Array of risk analysis cards
 * @returns {Array} Array of routine template objects
 */
export function buildRoutineCardsFromRiskCards(riskCards = []) {
  const routineCards = [];

  for (const card of riskCards) {
    const controls = String(card.controls || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    for (const control of controls) {
      const routine = mapControlToRoutine(card, control);
      if (routine) {
        routineCards.push(routine);
      }
    }
  }

  return routineCards;
}

/**
 * Map a single control text to a routine template.
 * 
 * @param {Object} card - The risk analysis card
 * @param {string} control - The control text to map
 * @returns {Object|null} Routine template or null if no match
 */
export function mapControlToRoutine(card, control) {
  // 1. Varemodtagelse
  if (control === "Varemodtagelse") {
    return {
      riskCardId: card.id,
      guideKey: "receiving_goods",
      title: "Varemodtagelse",
      taskType: "checklist",
      frequency: "per_delivery",
      sourceControl: control
    };
  }

  // 2. Køleskab / køl (+5)
  if (control.includes("(+5)")) {
    const unitName = control.replace("(+5)", "").trim();
    return {
      riskCardId: card.id,
      guideKey: "fridge_temperature",
      title: `Temperaturkontrol – ${unitName}`,
      taskType: "measurement",
      frequency: "daily",
      sourceControl: control,
      measurementConfig: {
        unit: "°C",
        optimal: 5,
        min: 0,
        max: 5,
        criticalMax: 8
      }
    };
  }

  // 3. Fryser (-18)
  if (control.includes("(-18)")) {
    const unitName = control.replace("(-18)", "").trim();
    return {
      riskCardId: card.id,
      guideKey: "freezer_temperature",
      title: `Temperaturkontrol – ${unitName}`,
      taskType: "measurement",
      frequency: "daily",
      sourceControl: control,
      measurementConfig: {
        unit: "°C",
        optimal: -18,
        max: -18,
        criticalMax: -12
      }
    };
  }

  // 4. Varmebehandling af fødevarer
  if (control === "Varmebehandling af fødevarer") {
    return {
      riskCardId: card.id,
      guideKey: "hot_preparation_core_temperature",
      title: "Varmebehandling af fødevarer",
      taskType: "measurement",
      frequency: "per_batch",
      sourceControl: control,
      measurementConfig: {
        unit: "°C",
        optimal: 75,
        min: 75
      }
    };
  }

  // 5. Genopvarmning af fødevarer
  if (control === "Genopvarmning af fødevarer") {
    return {
      riskCardId: card.id,
      guideKey: "hot_preparation_core_temperature",
      title: "Genopvarmning af fødevarer",
      taskType: "measurement",
      frequency: "per_batch",
      sourceControl: control,
      measurementConfig: {
        unit: "°C",
        optimal: 75,
        min: 75
      }
    };
  }

  // 6. Varmholdelse (+65)
  if (control === "Varmholdelse (+65)") {
    return {
      riskCardId: card.id,
      guideKey: "hot_holding",
      title: "Varmholdelse",
      taskType: "measurement",
      frequency: "daily",
      sourceControl: control,
      measurementConfig: {
        unit: "°C",
        optimal: 65,
        min: 65
      }
    };
  }

  // 7. Nedkøling af fødevarer
  if (control === "Nedkøling af fødevarer") {
    return {
      riskCardId: card.id,
      guideKey: "cooling_control",
      title: "Nedkøling af fødevarer",
      taskType: "workflow",
      frequency: "per_batch",
      sourceControl: control,
      measurementConfig: {
        startTemp: 65,
        endTemp: 10,
        maxTimeMinutes: 180
      }
    };
  }

  // 8. Skyllevand opvaskemaskine (+80)
  if (control === "Skyllevand opvaskemaskine (+80)") {
    return {
      riskCardId: card.id,
      guideKey: "dishwasher_control",
      title: "Opvaskemaskine – skyllevand",
      taskType: "measurement",
      frequency: "daily",
      sourceControl: control,
      measurementConfig: {
        unit: "°C",
        optimal: 80,
        min: 80
      }
    };
  }

  // No match found
  return null;
}
