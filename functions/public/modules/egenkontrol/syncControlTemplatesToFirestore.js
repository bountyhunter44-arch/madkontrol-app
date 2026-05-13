/**
 * syncControlTemplatesToFirestore.js
 *
 * Synkroniserer output fra generateControlTemplates() til Firestore
 * via batch write. Opretter/opdaterer templates og program-sektioner.
 *
 * Skriver KUN til:
 *   task_templates/
 *   verification_templates/
 *   program_sections/
 *
 * Opretter ALDRIG:
 *   task_instances/
 *   verification_instances/
 *
 * Brug:
 *   const result = await syncControlTemplatesToFirestore({ companyId, locationId, createdBy });
 */

import { db }                    from "../../core/firebase-config.js";
import { doc, writeBatch, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { generateControlTemplates }         from "./generateControlTemplates.js";

// Firestore tillader maks 500 operationer per batch
const BATCH_LIMIT = 499;

/**
 * @param {{ companyId: string, locationId: string, createdBy: string }} params
 * @returns {Promise<{
 *   success: boolean,
 *   counts: { taskTemplates: number, verificationTemplates: number, programSections: number },
 *   ids: { taskTemplateIds: string[], verificationTemplateIds: string[], programSectionIds: string[] }
 * }>}
 */
export async function syncControlTemplatesToFirestore({ companyId, locationId, createdBy }) {
  if (!companyId)  throw new Error("syncControlTemplatesToFirestore: companyId mangler.");
  if (!locationId) throw new Error("syncControlTemplatesToFirestore: locationId mangler.");
  if (!createdBy)  throw new Error("syncControlTemplatesToFirestore: createdBy mangler.");

  const { taskTemplates, verificationTemplates, programSections } =
    generateControlTemplates({ companyId, locationId, createdBy });

  // Saml alle write-operationer som { collection, docId, data }
  const writes = [];

  for (const template of taskTemplates) {
    writes.push({
      collection: "task_templates",
      docId: template.templateId,
      data: template,
    });
  }

  for (const template of verificationTemplates) {
    writes.push({
      collection: "verification_templates",
      docId: template.templateId,
      data: template,
    });
  }

  for (const section of programSections) {
    const docId =
      section.sectionId ||
      `${section.companyId}_${section.locationId}_${section.sectionKey}`;
    writes.push({
      collection: "program_sections",
      docId,
      data: section,
    });
  }

  // Kør i batches à maks BATCH_LIMIT operationer
  for (let i = 0; i < writes.length; i += BATCH_LIMIT) {
    const chunk = writes.slice(i, i + BATCH_LIMIT);
    const batch = writeBatch(db);
    console.log("[syncControlTemplates] batch", Math.floor(i / BATCH_LIMIT) + 1, "writing", chunk.length, "docs to collections:", [...new Set(chunk.map(w => w.collection))].join(", "));

    for (const write of chunk) {
      const ref = doc(db, write.collection, write.docId);
      batch.set(ref, {
        ...write.data,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    }

    await batch.commit();
  }

  return {
    success: true,
    counts: {
      taskTemplates:         taskTemplates.length,
      verificationTemplates: verificationTemplates.length,
      programSections:       programSections.length,
    },
    ids: {
      taskTemplateIds:         taskTemplates.map((t) => t.templateId),
      verificationTemplateIds: verificationTemplates.map((t) => t.templateId),
      programSectionIds:       programSections.map(
        (s) => s.sectionId || `${s.companyId}_${s.locationId}_${s.sectionKey}`
      ),
    },
  };
}
