/**
 * TASK TITLE RESOLVER
 * 
 * Unified resolver for task titles across all UI components.
 * Ensures consistent display names and handles backward compatibility.
 * 
 * Bruges af:
 * - rutiner.html
 * - rapporter.html
 * - dashboard.html
 * - afvigelser.html
 * - start-dag.html
 * 
 * VIGTIGT:
 * - Returnerer ALDRIG rå snake_case keys
 * - Håndterer både nye canonical keys og gamle danske keys
 * - Fallback til displayTitle/title hvis ikke canonical
 */

import { 
  normalizeTaskKey, 
  getCanonicalTask 
} from './canonicalTasks.js';

/**
 * Pretty name mapping for routine types
 * Maps snake_case keys to human-readable Danish names
 */
const ROUTINE_PRETTY_NAMES = {
  "koeleskab_temperatur": "Køleskabstemperatur",
  "fryser_temperatur": "Frysertemperatur",
  "nedkoeling": "Nedkøling",
  "opvarmning": "Opvarmning",
  "varmholdelse": "Varmholdelse",
  "varemodtagelse": "Varemodtagelse",
  "tre_timers_regel": "3-timersregel",
  "adskillelse": "Adskillelse",
  "friture_rengoering": "Friturerengøring",
  "paalaegsmaskine_rengoering": "Pålægsmaskine rengøring",
  "softice_maskine_rengoering": "Softicemaskine rengøring",
  "softicemaskine_rengoering": "Softicemaskine rengøring",
  "softicemaskine_temperatur": "Softicemaskine temperaturkontrol",
  "ismaskine_rengoering": "Ismaskine rengøring",
  "ismaskine_temperatur": "Ismaskine temperaturkontrol",
  "fryser_rengoering": "Fryserrengøring",
  "koekken_rengoering": "Køkkenrengøring",
  "koeleskab_rengoering": "Køleskabsrengøring",
  "opvaskemaskine_skyllevand": "Opvaskemaskine skyllevand",
  "personlig_hygiejne": "Personlig hygiejne",
  "rengoering": "Rengøring",
  "aarlig_revision": "Årlig revision",
  "sporbarhed": "Sporbarhed",
  "tilbagetraekning": "Tilbagetrækning",
  "opbevaring_koel_frost": "Opbevaring køl/frost",
  "salg_udenfor_koel": "Salg udenfor køl",
  "vareudbringning": "Vareudbringning",
  "vedligeholdelse_skadedyr": "Vedligeholdelse/skadedyr"
};

/**
 * Get pretty title from raw key
 */
function getPrettyTitleFromKey(key) {
  if (!key) return "";
  
  const normalized = String(key).toLowerCase()
    .replace(/[-_\s]+/g, "_")
    .trim();
  
  return ROUTINE_PRETTY_NAMES[normalized] || "";
}

/**
 * Resolve pretty title for a task
 * 
 * Priority:
 * 1. Canonical title (from normalized key)
 * 2. Pretty name from routine type mapping
 * 3. displayTitle
 * 4. title (if not snake_case)
 * 5. templateTitle
 * 6. name
 * 7. Fallback: "Rutine"
 * 
 * @param {object} task - Task object (template or instance)
 * @returns {string} - Pretty title
 */
export function resolveTaskTitle(task) {
  if (!task) return "Rutine";

  const isRawKeyLike = (value) => {
    const text = String(value || "").trim();
    return /^[a-z0-9]+(?:_[a-z0-9]+)+$/.test(text);
  };

  const isUnknownTitle = (value) => {
    const text = String(value || "").trim().toLowerCase();
    return !text || text === "ukendt rutine" || text === "unknown routine" || text === "undefined" || text === "null";
  };

  const resolvePrettyFromAnyKey = (...keys) => {
    for (const key of keys) {
      if (!key) continue;
      const normalizedKey = normalizeTaskKey(key);
      const canonical = getCanonicalTask(normalizedKey);
      if (canonical?.title) return canonical.title;

      const pretty = getPrettyTitleFromKey(key);
      if (pretty) return pretty;
    }
    return "";
  };

  const explicitTitles = [
    task.title,
    task.templateTitle,
    task.name,
    task.displayTitle,
    task.taskTitle,
    task.templateName,
    task.prettyName
  ];

  for (const value of explicitTitles) {
    if (isUnknownTitle(value)) continue;
    if (isRawKeyLike(value)) {
      const pretty = resolvePrettyFromAnyKey(value);
      if (pretty) return pretty;
      continue;
    }
    return String(value).trim();
  }
  
  // Try to find canonical title from key
  const rawKey = task.templateKey || task.taskKey || task.key || task.routineType || task.canonicalTaskKey || "";
  if (rawKey) {
    const prettyFromKey = resolvePrettyFromAnyKey(rawKey);
    if (prettyFromKey) return prettyFromKey;
  }
  
  return "Rutine";
}

/**
 * Resolve title with context (equipment/area name)
 * 
 * For equipment-specific tasks like "Temperaturkontrol – Køleskab 1"
 * 
 * @param {object} task - Task object
 * @returns {string} - Title with context
 */
export function resolveTaskTitleWithContext(task) {
  if (!task) return "Rutine";
  
  const baseTitle = resolveTaskTitle(task);
  const context = task.equipmentName || 
                  task.areaName || 
                  task.equipmentType || 
                  task.areaType || 
                  "";
  
  // Don't duplicate if context is already in title
  if (context && !baseTitle.includes(context)) {
    return `${baseTitle} – ${context}`;
  }
  
  return baseTitle;
}

/**
 * Resolve group/category display name
 * 
 * @param {object} task - Task object
 * @returns {string} - Group display name
 */
export function resolveTaskGroup(task) {
  if (!task) return "";
  
  const group = task.group || task.category || "";
  
  const groupMap = {
    "CCP": "CCP",
    "GAG": "GAG",
    "LEGAL": "Lovpligtig",
    "ccp": "CCP",
    "gag": "GAG",
    "legal": "Lovpligtig",
    "kritisk": "CCP",
    "god_arbejdsgang": "GAG",
    "lovpligtig": "Lovpligtig"
  };
  
  return groupMap[group] || group || "";
}

/**
 * Resolve frequency display text
 * 
 * @param {object} task - Task object
 * @returns {string} - Frequency text (e.g., "Daglig", "Ugentlig")
 */
export function resolveTaskFrequency(task) {
  if (!task) return "";
  
  const frequencyDays = task.frequencyDays || 
                        task.interval_days || 
                        task.scheduleConfig?.recurrenceValue || 
                        0;
  
  if (frequencyDays === 1) return "Daglig";
  if (frequencyDays === 7) return "Ugentlig";
  if (frequencyDays === 14) return "Hver 14. dag";
  if (frequencyDays === 30) return "Månedlig";
  if (frequencyDays === 365) return "Årlig";
  
  if (frequencyDays > 0) {
    return `Hver ${frequencyDays}. dag`;
  }
  
  // Fallback to frequency field
  const frequency = task.frequency || task.frequencyType || "";
  const frequencyMap = {
    "daily": "Daglig",
    "weekly": "Ugentlig",
    "monthly": "Månedlig",
    "yearly": "Årlig",
    "daglig": "Daglig",
    "ugentlig": "Ugentlig",
    "månedlig": "Månedlig",
    "årlig": "Årlig"
  };
  
  return frequencyMap[frequency.toLowerCase()] || frequency || "";
}

/**
 * Get icon for task based on category/type
 * 
 * @param {object} task - Task object
 * @returns {string} - Emoji icon
 */
export function resolveTaskIcon(task) {
  if (!task) return "📋";
  
  const category = String(task.category || task.type || "").toLowerCase();
  const title = String(task.title || "").toLowerCase();
  const key = task.templateKey || task.taskKey || task.key || "";
  const normalizedKey = normalizeTaskKey(key);
  
  // Icon mapping by canonical key
  const iconMap = {
    "varemodtagelse": "📦",
    "opbevaring_koel_frost": "🌡️",
    "opvarmning": "🔥",
    "nedkoeling": "❄️",
    "varmholdelse": "♨️",
    "salg_udenfor_koel": "🏪",
    "adskillelse": "🔀",
    "vareudbringning": "🚚",
    "rengoering": "🧹",
    "paalaegsmaskine_rengoering": "🧼",
    "softice_maskine_rengoering": "🧼",
    "softicemaskine_rengoering": "🧼",
    "softicemaskine_temperatur": "🌡️",
    "ismaskine_rengoering": "🧼",
    "ismaskine_temperatur": "🌡️",
    "personlig_hygiejne": "🧼",
    "vedligeholdelse_skadedyr": "🔧",
    "sporbarhed": "🔍",
    "tilbagetraekning": "↩️",
    "aarlig_revision": "📊"
  };
  
  if (iconMap[normalizedKey]) {
    return iconMap[normalizedKey];
  }
  
  // Fallback based on category/title
  if (category.includes('temperatur') || title.includes('temperatur')) return "🌡️";
  if (category.includes('rengør') || title.includes('rengør')) return "🧹";
  if (category.includes('modtagelse') || title.includes('modtagelse')) return "📦";
  if (category.includes('opvarmning') || title.includes('opvarmning')) return "🔥";
  if (category.includes('nedkøl') || title.includes('nedkøl')) return "❄️";
  if (category.includes('varmhold') || title.includes('varmhold')) return "♨️";
  if (category.includes('hygiejne') || title.includes('hygiejne')) return "🧼";
  if (category.includes('vedligehold') || title.includes('vedligehold')) return "🔧";
  
  return "📋";
}

/**
 * Check if task is a CCP (Critical Control Point)
 * 
 * @param {object} task - Task object
 * @returns {boolean}
 */
export function isTaskCCP(task) {
  if (!task) return false;
  
  const group = task.group || task.category || "";
  if (group === "CCP" || group === "ccp") return true;
  
  const key = task.templateKey || task.taskKey || task.key || "";
  const normalizedKey = normalizeTaskKey(key);
  const canonical = getCanonicalTask(normalizedKey);
  
  return canonical?.group === "CCP";
}

/**
 * Get badge color for task group
 * 
 * @param {object} task - Task object
 * @returns {string} - CSS color class or hex color
 */
export function resolveTaskBadgeColor(task) {
  if (!task) return "#6b7280";
  
  const group = task.group || task.category || "";
  
  const colorMap = {
    "CCP": "#dc2626",      // Red
    "GAG": "#ea580c",      // Orange
    "LEGAL": "#2563eb",    // Blue
    "ccp": "#dc2626",
    "gag": "#ea580c",
    "legal": "#2563eb"
  };
  
  return colorMap[group] || "#6b7280";
}
