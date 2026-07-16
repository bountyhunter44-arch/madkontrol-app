/**
 * controlDefinitionRegistry.js
 *
 * Samler alle control-definitioner i ét fælles registry.
 * Importér herfra i stedet for at importere de 3 biblioteksfiler separat.
 *
 * Eksporter:
 *   allControlDefinitions                      — alle definitioner som ét array
 *   getControlDefinitionByKey(key)             — find definition på key
 *   getOperationalDefinitions()                — kun libraryType === "operational"
 *   getProgramDefinitions()                    — kun libraryType === "program"
 *   getVerificationDefinitions()               — kun libraryType === "verification"
 *   getDefinitionsByLibraryType(libraryType)   — generisk filter
 *   groupDefinitionsByLibraryType()            — grupperet output
 */

import { controlLibraryOperational } from "./controlLibraryOperational.js";
import { controlLibraryProgram }      from "./controlLibraryProgram.js";
import { controlLibraryVerification } from "./controlLibraryVerification.js";

// ─────────────────────────────────────────────────────────────────────────────
// BYG OG VALIDER REGISTRY
// ─────────────────────────────────────────────────────────────────────────────

function _buildRegistry() {
  const combined = [
    ...controlLibraryOperational,
    ...controlLibraryProgram,
    ...controlLibraryVerification,
  ];

  // Duplikatsikring — kast fejl ved gentagelse af samme key
  const seen = new Set();
  for (const def of combined) {
    if (seen.has(def.key)) {
      throw new Error(
        `controlDefinitionRegistry: Duplikat key fundet: "${def.key}". ` +
        `Hver definition skal have en unik key på tværs af alle biblioteker.`
      );
    }
    seen.add(def.key);
  }

  // Stabil sortering: sortOrder asc → title asc
  combined.sort((a, b) => {
    const orderA = a.sortOrder ?? 999;
    const orderB = b.sortOrder ?? 999;
    if (orderA !== orderB) return orderA - orderB;
    return (a.title ?? "").localeCompare(b.title ?? "", "da");
  });

  return combined;
}

// ─────────────────────────────────────────────────────────────────────────────
// REGISTRY — indlæst og valideret ved modul-load
// ─────────────────────────────────────────────────────────────────────────────

export const allControlDefinitions = _buildRegistry();

// ─────────────────────────────────────────────────────────────────────────────
// OPSLAG
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Find en definition på dens unikke key.
 * @param {string} key
 * @returns {object|null}
 */
export function getControlDefinitionByKey(key) {
  return allControlDefinitions.find((d) => d.key === key) ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// FILTER HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @returns {object[]} Kun operationelle definitioner (libraryType === "operational")
 */
export function getOperationalDefinitions() {
  return allControlDefinitions.filter((d) => d.libraryType === "operational");
}

/**
 * @returns {object[]} Kun programdefinitioner (libraryType === "program")
 */
export function getProgramDefinitions() {
  return allControlDefinitions.filter((d) => d.libraryType === "program");
}

/**
 * @returns {object[]} Kun verifikationsdefinitioner (libraryType === "verification")
 */
export function getVerificationDefinitions() {
  return allControlDefinitions.filter((d) => d.libraryType === "verification");
}

/**
 * Generisk filter på libraryType.
 * @param {"operational"|"program"|"verification"} libraryType
 * @returns {object[]}
 */
export function getDefinitionsByLibraryType(libraryType) {
  return allControlDefinitions.filter((d) => d.libraryType === libraryType);
}

// ─────────────────────────────────────────────────────────────────────────────
// GRUPPERET OUTPUT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returnerer alle definitioner grupperet på libraryType.
 * @returns {{ operational: object[], program: object[], verification: object[] }}
 */
export function groupDefinitionsByLibraryType() {
  return {
    operational:  getOperationalDefinitions(),
    program:      getProgramDefinitions(),
    verification: getVerificationDefinitions(),
  };
}
