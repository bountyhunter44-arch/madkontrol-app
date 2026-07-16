/**
 * generateControlTemplates.js
 *
 * Genererer Firestore-dokumenter for alle control-definitioner i registryet.
 * Skriver IKKE til Firestore — returnerer kun objekter klar til write.
 *
 * Brug:
 *   const result = generateControlTemplates({ companyId, locationId, createdBy });
 *   // result.taskTemplates, result.verificationTemplates, result.programSections
 */

import {
  getOperationalDefinitions,
  getVerificationDefinitions,
  getProgramDefinitions,
} from "./controlDefinitionRegistry.js";

import {
  buildTaskTemplateDocument,
  buildVerificationTemplateDocument,
  buildProgramSectionDocument,
} from "./controlLibraryHelpers.js";

/**
 * Generér alle templates og sektioner for én virksomhed/lokation.
 *
 * @param {{ companyId: string, locationId: string, createdBy: string }} params
 * @returns {{
 *   taskTemplates: object[],
 *   verificationTemplates: object[],
 *   programSections: object[]
 * }}
 */
export function generateControlTemplates({ companyId, locationId, createdBy }) {
  if (!companyId)  throw new Error("generateControlTemplates: companyId mangler.");
  if (!locationId) throw new Error("generateControlTemplates: locationId mangler.");
  if (!createdBy)  throw new Error("generateControlTemplates: createdBy mangler.");

  const scope = { companyId, locationId, createdBy };

  const taskTemplates = getOperationalDefinitions().map((def) =>
    buildTaskTemplateDocument(def, scope)
  );

  const verificationTemplates = getVerificationDefinitions().map((def) =>
    buildVerificationTemplateDocument(def, scope)
  );

  const programSections = getProgramDefinitions().map((def) =>
    buildProgramSectionDocument(def, scope)
  );

  return { taskTemplates, verificationTemplates, programSections };
}
