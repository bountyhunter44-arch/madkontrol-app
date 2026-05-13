/**
 * CANONICAL EGENKONTROL TASK MODEL
 * 
 * Dette er den autoritative kilde til alle standard egenkontrol-rutiner.
 * Baseret på Fødevarestyrelsens "Eksempel på egenkontrol".
 * 
 * Bruges af:
 * - Backend: functions/index.js (generateCanonicalTaskTemplates)
 * - Frontend: rutiner.html, rapporter.html, dashboard.html
 * 
 * VIGTIGT:
 * - Keys må IKKE indeholde danske specialtegn (ø, æ, å)
 * - Keys skal være stabile og unikke
 * - Titles kan indeholde danske tegn
 * - FrequencyDays bestemmer hvor ofte rutinen skal udføres
 */

export const CANONICAL_EGENKONTROL_TASKS = [
  // CCP (Critical Control Points) - Daglige rutiner
  { 
    key: "varemodtagelse", 
    group: "CCP", 
    title: "Varemodtagelse", 
    frequencyDays: 1,
    description: "Kontrol af temperatur og kvalitet ved modtagelse af varer",
    guideKey: "goods_receiving"
  },
  { 
    key: "opbevaring_koel_frost", 
    group: "CCP", 
    title: "Opbevaring køl og frost", 
    frequencyDays: 1,
    description: "Temperaturkontrol af køle- og fryseenheder",
    guideKey: "storage_temperature"
  },
  { 
    key: "opvarmning", 
    group: "CCP", 
    title: "Opvarmning", 
    frequencyDays: 1,
    description: "Kontrol af opvarmning til korrekt kernetemperatur",
    guideKey: "reheating_control"
  },
  { 
    key: "nedkoeling", 
    group: "CCP", 
    title: "Nedkøling", 
    frequencyDays: 1,
    description: "Kontrol af nedkøling af tilberedt mad",
    guideKey: "cooling_control"
  },
  { 
    key: "varmholdelse", 
    group: "CCP", 
    title: "Varmholdelse", 
    frequencyDays: 1,
    description: "Kontrol af varmholdelse af tilberedt mad",
    guideKey: "hot_holding"
  },

  // GAG (Gode Arbejdsgange) - Ugentlige/månedlige rutiner
  { 
    key: "salg_udenfor_koel", 
    group: "GAG", 
    title: "Salg og opbevaring udenfor køl", 
    frequencyDays: 7,
    description: "Kontrol af varer der opbevares ved stuetemperatur",
    guideKey: "room_temp_storage"
  },
  { 
    key: "adskillelse", 
    group: "GAG", 
    title: "Adskillelse", 
    frequencyDays: 7,
    description: "Kontrol af adskillelse mellem rå og tilberedte varer",
    guideKey: "separation_control"
  },
  { 
    key: "vareudbringning", 
    group: "GAG", 
    title: "Vareudbringning", 
    frequencyDays: 7,
    description: "Kontrol af transport og udbringning af varer",
    guideKey: "delivery_control"
  },
  { 
    key: "rengoering", 
    group: "GAG", 
    title: "Rengøring", 
    frequencyDays: 1,
    description: "Daglig rengøring og desinfektion",
    guideKey: "cleaning_control"
  },
  { 
    key: "personlig_hygiejne", 
    group: "GAG", 
    title: "Personlig hygiejne", 
    frequencyDays: 7,
    description: "Kontrol af personlig hygiejne og håndvask",
    guideKey: "personal_hygiene"
  },
  { 
    key: "vedligeholdelse_skadedyr", 
    group: "GAG", 
    title: "Vedligeholdelse og skadedyrssikring", 
    frequencyDays: 30,
    description: "Kontrol af vedligeholdelse og skadedyrssikring",
    guideKey: "maintenance_pest_control"
  },

  // LEGAL (Lovpligtige kontroller) - Månedlige/årlige
  { 
    key: "sporbarhed", 
    group: "LEGAL", 
    title: "Sporbarhed", 
    frequencyDays: 30,
    description: "Kontrol af sporbarhed og mærkning",
    guideKey: "traceability"
  },
  { 
    key: "tilbagetraekning", 
    group: "LEGAL", 
    title: "Tilbagetrækning", 
    frequencyDays: 30,
    description: "Test af tilbagetrækningsprocedure",
    guideKey: "recall_procedure"
  },
  { 
    key: "aarlig_revision", 
    group: "LEGAL", 
    title: "Årlig kontrol og revision", 
    frequencyDays: 365,
    description: "Årlig gennemgang af egenkontrolprogram",
    guideKey: "annual_review"
  }
];

/**
 * KEY ALIASES - Backward compatibility
 * 
 * Mapper gamle keys (med danske tegn) til nye canonical keys.
 * Sikrer at eksisterende data stadig virker.
 */
export const KEY_ALIASES = {
  // Danske tegn → ASCII
  "opbevaring_køl_frost": "opbevaring_koel_frost",
  "nedkøling": "nedkoeling",
  "rengøring": "rengoering",
  "tilbagetrækning": "tilbagetraekning",
  
  // Varianter og forkortelser
  "opbevaring": "opbevaring_koel_frost",
  "køl_frost": "opbevaring_koel_frost",
  "koel_frost": "opbevaring_koel_frost",
  "storage": "opbevaring_koel_frost",
  "cooling": "nedkoeling",
  "cleaning": "rengoering",
  "revision": "aarlig_revision",
  "annual_review": "aarlig_revision",
  
  // Gamle kombinerede keys
  "varemodtagelse_transport": "varemodtagelse",
  "receiving": "varemodtagelse",
  "reheating": "opvarmning",
  "hot_holding": "varmholdelse",
  "separation": "adskillelse",
  "delivery": "vareudbringning",
  "hygiene": "personlig_hygiejne",
  "maintenance": "vedligeholdelse_skadedyr",
  "traceability": "sporbarhed",
  "recall": "tilbagetraekning"
};

/**
 * Normaliser task key til canonical form
 * 
 * @param {string} rawKey - Rå key fra database eller UI
 * @returns {string} - Normalized canonical key
 */
export function normalizeTaskKey(rawKey) {
  if (!rawKey) return "";
  
  const cleaned = String(rawKey).toLowerCase().trim();
  
  // Check if it's an alias
  if (KEY_ALIASES[cleaned]) {
    return KEY_ALIASES[cleaned];
  }
  
  // Check if it's already canonical
  const isCanonical = CANONICAL_EGENKONTROL_TASKS.some(task => task.key === cleaned);
  if (isCanonical) {
    return cleaned;
  }
  
  // Return as-is if not recognized (for custom tasks)
  return cleaned;
}

/**
 * Find canonical task definition by key
 * 
 * @param {string} key - Task key (raw or normalized)
 * @returns {object|null} - Canonical task definition or null
 */
export function getCanonicalTask(key) {
  const normalized = normalizeTaskKey(key);
  return CANONICAL_EGENKONTROL_TASKS.find(task => task.key === normalized) || null;
}

/**
 * Get all canonical tasks by group
 * 
 * @param {string} group - "CCP", "GAG", or "LEGAL"
 * @returns {array} - Array of canonical tasks
 */
export function getCanonicalTasksByGroup(group) {
  return CANONICAL_EGENKONTROL_TASKS.filter(task => task.group === group);
}

/**
 * Get canonical sort order for a task key
 * Used for consistent sorting across UI
 * 
 * @param {string} key - Task key
 * @returns {number} - Sort order (lower = earlier)
 */
export function getCanonicalSortOrder(key) {
  const normalized = normalizeTaskKey(key);
  const index = CANONICAL_EGENKONTROL_TASKS.findIndex(task => task.key === normalized);
  return index >= 0 ? index : 999;
}

/**
 * Group priority for sorting
 */
export const GROUP_PRIORITY = {
  "CCP": 1,
  "GAG": 2,
  "LEGAL": 3
};

/**
 * Compare function for sorting tasks canonically
 * 
 * Usage: tasks.sort(compareTasksCanonically)
 */
export function compareTasksCanonically(a, b) {
  const aGroup = a.group || a.category || "";
  const bGroup = b.group || b.category || "";
  
  const aPriority = GROUP_PRIORITY[aGroup] || 999;
  const bPriority = GROUP_PRIORITY[bGroup] || 999;
  
  if (aPriority !== bPriority) {
    return aPriority - bPriority;
  }
  
  const aKey = a.templateKey || a.taskKey || a.key || "";
  const bKey = b.templateKey || b.taskKey || b.key || "";
  
  const aOrder = getCanonicalSortOrder(aKey);
  const bOrder = getCanonicalSortOrder(bKey);
  
  return aOrder - bOrder;
}
