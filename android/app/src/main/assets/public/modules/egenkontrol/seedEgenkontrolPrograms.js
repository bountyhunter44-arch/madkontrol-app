// Filnavn: seedEgenkontrolPrograms.js

const admin = require("firebase-admin");
const db = admin.firestore();

async function seedCompanyEgenkontrolProgramsFromTemplates({ companyId, locationId }) {
  const templatesSnapshot = await db
    .collection("global_egenkontrol_program_templates")
    .where("isActive", "==", true)
    .get();

  if (templatesSnapshot.empty) {
    console.log("Ingen aktive skabeloner.");
    return;
  }

  const batch = db.batch();
  const now = admin.firestore.Timestamp.now();

  templatesSnapshot.forEach(doc => {
    const data = doc.data();
    const sectionKey = data.key;

    const firmaDocRef = db
      .collection("companies")
      .doc(companyId)
      .collection("egenkontrol_programs")
      .doc(sectionKey);

    const firmaData = {
      ...data,
      companyId,
      locationId,
      sourceTemplateKey: sectionKey,
      createdFrom: "onboarding",
      status: "draft",
      requiresReview: true,
      updatedAt: now,
    };

    batch.set(firmaDocRef, firmaData);
  });

  await batch.commit();
  console.log("Egenkontrolprogram genereret for companyId:", companyId);
}

module.exports = { seedCompanyEgenkontrolProgramsFromTemplates };