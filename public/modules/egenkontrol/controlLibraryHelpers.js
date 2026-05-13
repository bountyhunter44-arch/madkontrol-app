/**
 * controlLibraryHelpers.js
 *
 * D. Type guards — afgør hvad en definition må generere
 * E. Frekvenslogik — isActiveForDate, getNextDueDate, getFrequencyLabel
 * F. Firestore document builders — én builder per collection
 *
 * Collections:
 *   task_templates/           ← operational definitions
 *   task_instances/           ← operational instanser (daily/weekly/monthly)
 *   verification_templates/   ← verification definitions
 *   verification_instances/   ← interval-baserede verifikationsinstanser
 *   program_sections/         ← strukturdefinition per virksomhed (én per sectionKey)
 *   program_answers/          ← brugerens svar på en program-sektion
 *
 * Frekvensfelter i definition.frequency:
 *   mode          — "daily" | "weekly" | "monthly" | "event_based" | "interval_days"
 *   intervalDays  — antal dage (kun interval_days)
 *   daysOfWeek    — number[] (0=søndag) (kun weekly)
 *   daysOfMonth   — number[] (kun monthly, understøtter flere dage)
 */

// ─────────────────────────────────────────────────────────────────────────────
// D. TYPE GUARDS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returnerer true hvis definitionen skal gemmes i task_templates.
 * Kun operational-typer.
 *
 * @param {object} definition
 * @returns {boolean}
 */
export function isOperationalDefinition(definition) {
  return definition?.libraryType === "operational";
}

/**
 * Returnerer true hvis definitionen skal gemmes i verification_templates.
 * Kun verification-typer.
 *
 * @param {object} definition
 * @returns {boolean}
 */
export function isVerificationDefinition(definition) {
  return definition?.libraryType === "verification";
}

/**
 * Returnerer true hvis definitionen er et program-afsnit.
 * Program-afsnit genererer hverken task_templates eller verification_templates.
 *
 * @param {object} definition
 * @returns {boolean}
 */
export function isProgramDefinition(definition) {
  return definition?.libraryType === "program";
}

/**
 * Returnerer true hvis definitionen skal generere operational task_instances.
 * Dækker daily, weekly, monthly og event_based (event_based genereres manuelt,
 * men definitionen er stadig klar til instansgenerering).
 * event_based aktiveres IKKE automatisk pr. dato — se isActiveForDate().
 *
 * @param {object} definition
 * @returns {boolean}
 */
export function shouldGenerateOperationalInstance(definition) {
  if (!isOperationalDefinition(definition)) return false;
  const mode = definition.frequency?.mode;
  return mode === "daily" || mode === "event_based" || mode === "weekly" || mode === "monthly";
}

/**
 * Returnerer true hvis definitionen skal generere verification_instances.
 * Kun verification + interval_days frekvens.
 *
 * @param {object} definition
 * @returns {boolean}
 */
export function shouldGenerateVerificationInstance(definition) {
  return isVerificationDefinition(definition) && definition.frequency?.mode === "interval_days";
}

/**
 * @deprecated Brug isOperationalDefinition() eller isVerificationDefinition() i stedet.
 * Bevares for bagudkompatibilitet.
 */
export function shouldGenerateTaskTemplate(definition) {
  return isOperationalDefinition(definition) || isVerificationDefinition(definition);
}


// ─────────────────────────────────────────────────────────────────────────────
// E. FREQUENCY LOGIC
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bestemmer om en definition er aktiv for en given dato (dateKey = "YYYY-MM-DD").
 * event_based returnerer altid false — disse genereres ikke automatisk pr. dato.
 *
 * @param {object} definition
 * @param {string} dateKey                  - Dato der tjekkes (YYYY-MM-DD)
 * @param {string|null} lastInstanceDateKey - Senest oprettede instans (YYYY-MM-DD eller null)
 * @returns {{ active: boolean, reason: string }}
 */
export function isActiveForDate(definition, dateKey, lastInstanceDateKey = null) {
  if (!definition?.frequency) {
    return { active: false, reason: "Ingen frekvens defineret" };
  }

  const { mode, intervalDays, daysOfWeek, daysOfMonth } = definition.frequency;

  switch (mode) {
    case "daily":
      return { active: true, reason: "Daglig rutine" };

    case "event_based":
      return { active: false, reason: "Event-baseret — genereres ikke automatisk pr. dato" };

    case "weekly": {
      const dayOfWeek = parseDate(dateKey).getDay(); // 0=søndag, 1=mandag…
      const allowed = daysOfWeek ?? [1]; // default mandag
      return allowed.includes(dayOfWeek)
        ? { active: true, reason: `Ugentlig (ugedag ${dayOfWeek})` }
        : { active: false, reason: `Ikke aktiv denne dag (${dateKey})` };
    }

    case "monthly": {
      const dom = parseDate(dateKey).getDate();
      const targets = daysOfMonth ?? [1]; // understøtter array af dage
      return targets.includes(dom)
        ? { active: true, reason: `Månedlig den ${dom}.` }
        : { active: false, reason: `Ikke aktiv denne dag (mål: den ${targets.join("/")}.)` };
    }

    case "interval_days": {
      if (!lastInstanceDateKey) {
        return { active: true, reason: "Ingen tidligere instans — første kørsel" };
      }
      const daysSinceLast = Math.floor((parseDate(dateKey) - parseDate(lastInstanceDateKey)) / 86400000);
      const interval = intervalDays ?? 365;
      return daysSinceLast >= interval
        ? { active: true, reason: `${daysSinceLast} dage siden sidst (interval: ${interval})` }
        : { active: false, reason: `${daysSinceLast} dage siden sidst — ${interval - daysSinceLast} dage til næste` };
    }

    default:
      return { active: false, reason: `Ukendt frekvenstilstand: ${mode}` };
  }
}

/**
 * Beregner næste forfaldsdato for en interval_days-definition.
 * Returnerer null hvis mode ikke er interval_days eller lastInstanceDateKey mangler.
 *
 * @param {object} definition
 * @param {string|null} lastInstanceDateKey - YYYY-MM-DD
 * @returns {string|null} YYYY-MM-DD eller null
 */
export function getNextDueDate(definition, lastInstanceDateKey) {
  if (definition?.frequency?.mode !== "interval_days") return null;
  if (!lastInstanceDateKey) return null;
  const interval = definition.frequency.intervalDays ?? 365;
  const last = parseDate(lastInstanceDateKey);
  last.setDate(last.getDate() + interval);
  return formatDateKey(last);
}

/**
 * Returnerer en dansk tekstlabel for frekvensen på en definition.
 *
 * @param {object} definition
 * @returns {string}
 */
export function getFrequencyLabel(definition) {
  const f = definition?.frequency;
  if (!f) return "Ingen frekvens";

  switch (f.mode) {
    case "daily":        return "Daglig";
    case "event_based":  return "Event-baseret";
    case "weekly":       return "Ugentlig";
    case "monthly":      return "Månedlig";
    case "interval_days":
      if (f.intervalDays === 365)  return "Årlig";
      if (f.intervalDays === 1095) return "Hvert 3. år";
      if (f.intervalDays === 90)   return "Hvert kvartal";
      if (f.intervalDays === 30)   return "Månedlig (interval)";
      return `Hver ${f.intervalDays} dage`;
    default: return f.mode;
  }
}

/**
 * Validerer en record mod en definitions rules[]-array.
 * Returnerer liste af udløste regler.
 *
 * @param {object} definition
 * @param {object} values  - { fieldKey: value }
 * @returns {{ rule: object, message: string, severity: string }[]}
 */
export function evaluateRules(definition, values) {
  const triggered = [];

  for (const rule of definition?.rules ?? []) {
    if (rule.type === "temperature_threshold") {
      const temp = parseFloat(values[rule.field]);
      if (isNaN(temp)) continue;
      // Betinget regel — gælder kun hvis et andet felt matcher
      if (rule.condition && values[rule.condition.field] !== rule.condition.value) continue;
      if (rule.max !== undefined && temp > rule.max) {
        triggered.push({ rule, message: rule.deviationMessage, severity: rule.severity });
      }
    }

    if (rule.type === "field_value_trigger") {
      if (String(values[rule.field]) === String(rule.value)) {
        triggered.push({ rule, message: rule.deviationMessage, severity: rule.severity });
      }
    }
  }

  return triggered;
}


// ─────────────────────────────────────────────────────────────────────────────
// F. FIRESTORE DOCUMENT BUILDERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bygger et task_templates/-dokument fra en operational definition.
 * templateId er scope-sikkert: `${companyId}_${locationId}_${definition.key}`
 *
 * @param {object} definition  - operational definition
 * @param {object} scope       - { companyId, locationId, createdBy }
 * @returns {object}
 */
export function buildTaskTemplateDocument(definition, scope) {
  if (!isOperationalDefinition(definition)) {
    throw new Error(`buildTaskTemplateDocument: '${definition?.key}' er ikke operational (libraryType: ${definition?.libraryType})`);
  }

  return {
    templateId:    `${scope.companyId}_${scope.locationId}_${definition.key}`,
    title:         definition.title,
    category:      definition.category ?? "",
    controlType:   definition.controlType ?? definition.key,
    equipmentType:      definition.equipmentType      ?? "",
    libraryType:        "operational",
    templateType:       "operational",
    targetTemperature:  definition.targetTemperature   ?? null,
    thresholds:         definition.thresholds          ?? {},
    defaultValues:      definition.defaultValues       ?? {},
    formDefinition:     definition.formDefinition      ?? {},
    displayHints:       definition.displayHints        ?? {},
    frequency:     definition.frequency,
    riskLevel:     definition.riskLevel ?? "medium",
    fields:        definition.fields ?? [],
    rules:         definition.rules ?? [],
    actions:       definition.actions ?? {},
    guideTitle:    definition.guide?.title ?? "",
    guideBody:     definition.guide?.body ?? "",
    schemaVersion: definition.schemaVersion ?? 1,
    companyId:     scope.companyId,
    locationId:    scope.locationId,
    createdBy:     scope.createdBy,
    isActive:      true,
    createdAt:     new Date().toISOString()
  };
}

/**
 * Bygger et verification_templates/-dokument fra en verification definition.
 * templateId er scope-sikkert: `${companyId}_${locationId}_${definition.key}`
 *
 * @param {object} definition  - verification definition
 * @param {object} scope       - { companyId, locationId, createdBy }
 * @returns {object}
 */
export function buildVerificationTemplateDocument(definition, scope) {
  if (!isVerificationDefinition(definition)) {
    throw new Error(`buildVerificationTemplateDocument: '${definition?.key}' er ikke verification (libraryType: ${definition?.libraryType})`);
  }

  return {
    templateId:    `${scope.companyId}_${scope.locationId}_${definition.key}`,
    title:         definition.title,
    controlType:   definition.controlType ?? definition.key,
    libraryType:   "verification",
    frequency:     definition.frequency,
    riskLevel:     definition.riskLevel ?? "medium",
    fields:        definition.fields ?? [],
    actions:       definition.actions ?? {},
    guideTitle:    definition.guide?.title ?? "",
    guideBody:     definition.guide?.body ?? "",
    schemaVersion: definition.schemaVersion ?? 1,
    companyId:     scope.companyId,
    locationId:    scope.locationId,
    createdBy:     scope.createdBy,
    isActive:      true,
    createdAt:     new Date().toISOString()
  };
}

/**
 * Bygger et program_sections/-dokument.
 * Gemmer strukturdefinitionen for et program-afsnit per virksomhed/lokation.
 * Ét dokument per sectionKey — ingen brugerdata her.
 *
 * Firestore doc id: `${companyId}_${locationId}_${definition.key}`
 *
 * @param {object} definition  - program definition
 * @param {object} scope       - { companyId, locationId }
 * @returns {object}
 */
export function buildProgramSectionDocument(definition, scope) {
  if (!isProgramDefinition(definition)) {
    throw new Error(`buildProgramSectionDocument: '${definition?.key}' er ikke program (libraryType: ${definition?.libraryType})`);
  }

  return {
    sectionId:     `${scope.companyId}_${scope.locationId}_${definition.key}`,
    sectionKey:    definition.key,
    title:         definition.title,
    sortOrder:     definition.sortOrder ?? 0,
    guideTitle:    definition.guide?.title ?? "",
    guideBody:     definition.guide?.body ?? "",
    fieldSchema:   definition.fields ?? [],
    confirmations: definition.confirmations ?? [],
    schemaVersion: definition.schemaVersion ?? 1,
    companyId:     scope.companyId,
    locationId:    scope.locationId,
    createdAt:     new Date().toISOString()
  };
}

/**
 * Bygger et program_answers/-dokument.
 * Gemmer brugerens svar og bekræftelser på et program-afsnit.
 * Brug setDoc med merge ved opdatering.
 *
 * Firestore doc id: `${companyId}_${locationId}_${definition.key}`
 *
 * @param {object} definition          - program definition
 * @param {object} scope               - { companyId, locationId }
 * @param {object} fieldValues         - { fieldKey: value } fra collectFieldValues()
 * @param {object} confirmationValues  - { understood, understoodAt, understoodBy, approved, approvedAt, approvedBy, ... } fra collectConfirmationValues()
 * @returns {object}
 */
export function buildProgramAnswerDocument(definition, scope, fieldValues, confirmationValues) {
  if (!isProgramDefinition(definition)) {
    throw new Error(`buildProgramAnswerDocument: '${definition?.key}' er ikke program (libraryType: ${definition?.libraryType})`);
  }

  const now = new Date().toISOString();

  return {
    answerId:      `${scope.companyId}_${scope.locationId}_${definition.key}`,
    sectionKey:    definition.key,
    schemaVersion: definition.schemaVersion ?? 1,
    companyId:     scope.companyId,
    locationId:    scope.locationId,
    fields:        fieldValues ?? {},
    confirmations: confirmationValues ?? {},
    // Tydelige top-level bekræftelsesfelter til visning og filtering
    understood:    !!confirmationValues?.understood,
    approved:      !!confirmationValues?.approved,
    understoodAt:  confirmationValues?.understood ? (confirmationValues.understoodAt ?? now) : null,
    approvedAt:    confirmationValues?.approved   ? (confirmationValues.approvedAt   ?? now) : null,
    updatedAt:     now
  };
}


// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL UTILS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parser en YYYY-MM-DD streng til et Date-objekt.
 * Kaster fejl ved ugyldigt format.
 *
 * @param {string} dateKey
 * @returns {Date}
 */
function parseDate(dateKey) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey))) {
    throw new Error(`parseDate: ugyldigt datoformat '${dateKey}' — forventet YYYY-MM-DD`);
  }
  const [y, m, d] = String(dateKey).split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
