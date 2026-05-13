"use strict";

const admin = require("firebase-admin");
const { GLOBAL_EGENKONTROL_PROGRAM_TEMPLATES } = require("./config/globalEgenkontrolProgramTemplates");

function cloneDeep(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildDefaultFieldValue(field) {
  const type = String(field?.type || "").trim();

  if (type === "textarea") return "";
  if (type === "button_group") return "";
  if (type === "image") {
    return {
      files: [],
      notes: ""
    };
  }

  return "";
}

function normalizeField(field) {
  const cloned = cloneDeep(field || {});
  if (!Object.prototype.hasOwnProperty.call(cloned, "value")) {
    cloned.value = buildDefaultFieldValue(cloned);
  }
  return cloned;
}

function buildCompanyProgramDoc({
  template,
  companyId,
  locationId,
  createdFrom = "onboarding",
  now
}) {
  return {
    key: template.key || "",
    title: template.title || "",
    sortOrder: Number.isFinite(template.sortOrder) ? template.sortOrder : 9999,
    introText: template.introText || "",
    fields: Array.isArray(template.fields) ? template.fields.map(normalizeField) : [],
    isActive: template.isActive !== false,
    groupKey: template.groupKey || "",
    scheduleConfig: template.scheduleConfig ? cloneDeep(template.scheduleConfig) : null,

    status: "draft",
    requiresReview: true,

    companyId: companyId || "",
    locationId: locationId || "",
    sourceTemplateKey: template.key || "",
    createdFrom,

    renderedText: "",
    lastRenderedAt: null,

    createdAt: now,
    updatedAt: now
  };
}

async function seedCompanyEgenkontrolProgramsFromTemplates({
  db,
  companyId,
  locationId,
  createdFrom = "onboarding",
  overwriteExisting = false,
  templates = GLOBAL_EGENKONTROL_PROGRAM_TEMPLATES
}) {
  if (!db) {
    throw new Error("seedCompanyEgenkontrolProgramsFromTemplates kræver db");
  }
  if (!companyId) {
    throw new Error("seedCompanyEgenkontrolProgramsFromTemplates kræver companyId");
  }
  if (!locationId) {
    throw new Error("seedCompanyEgenkontrolProgramsFromTemplates kræver locationId");
  }

  const now = admin.firestore.FieldValue.serverTimestamp();
  const programsCollectionRef = db
    .collection("companies")
    .doc(companyId)
    .collection("egenkontrol_programs");

  const templateList = Array.isArray(templates) ? templates : [];
  if (!templateList.length) {
    return {
      created: 0,
      updated: 0,
      skipped: 0,
      totalTemplates: 0
    };
  }

  const existingSnapshot = await programsCollectionRef.get();
  const existingKeys = new Set(existingSnapshot.docs.map((doc) => doc.id));

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let batch = db.batch();
  let opCount = 0;

  const flushBatch = async () => {
    if (opCount === 0) return;
    await batch.commit();
    batch = db.batch();
    opCount = 0;
  };

  for (const template of templateList) {
    if (!template || !template.key) {
      skipped += 1;
      continue;
    }

    const docRef = programsCollectionRef.doc(template.key);
    const docData = buildCompanyProgramDoc({
      template,
      companyId,
      locationId,
      createdFrom,
      now
    });

    const exists = existingKeys.has(template.key);

    if (exists && !overwriteExisting) {
      skipped += 1;
      continue;
    }

    if (exists && overwriteExisting) {
      batch.set(
        docRef,
        {
          ...docData,
          createdAt: admin.firestore.FieldValue.delete(),
          updatedAt: now
        },
        { merge: true }
      );
      updated += 1;
    } else {
      batch.set(docRef, docData, { merge: false });
      created += 1;
    }

    opCount += 1;

    if (opCount >= 400) {
      await flushBatch();
    }
  }

  await flushBatch();

  return {
    created,
    updated,
    skipped,
    totalTemplates: templateList.length
  };
}

async function seedCompanyRecallTemplates({ db, companyId, locationId, overwriteExisting = false }) {
  if (!db) {
    throw new Error("seedCompanyRecallTemplates kræver db");
  }
  if (!companyId) {
    throw new Error("seedCompanyRecallTemplates kræver companyId");
  }
  if (!locationId) {
    throw new Error("seedCompanyRecallTemplates kræver locationId");
  }

  const { GLOBAL_RECALL_AUTO_TEMPLATES } = require("./recallAutoTemplates");

  const now = admin.firestore.FieldValue.serverTimestamp();
  const collectionRef = db
    .collection("companies")
    .doc(companyId)
    .collection("locations")
    .doc(locationId)
    .collection("recall_templates");

  const templateList = Array.isArray(GLOBAL_RECALL_AUTO_TEMPLATES) ? GLOBAL_RECALL_AUTO_TEMPLATES : [];
  if (!templateList.length) {
    return {
      created: 0,
      updated: 0,
      skipped: 0,
      totalTemplates: 0
    };
  }

  const existingSnapshot = await collectionRef.get();
  const existingKeys = new Set(existingSnapshot.docs.map((doc) => doc.id));

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let batch = db.batch();
  let opCount = 0;

  const flushBatch = async () => {
    if (opCount === 0) return;
    await batch.commit();
    batch = db.batch();
    opCount = 0;
  };

  for (const template of templateList) {
    if (!template || !template.key) {
      skipped += 1;
      continue;
    }

    const docRef = collectionRef.doc(template.key);
    const docData = {
      templateKey: template.key,
      title: template.title || "",
      introText: template.introText || "",
      fields: Array.isArray(template.fields) ? template.fields : [],
      sortOrder: Number.isFinite(template.sortOrder) ? template.sortOrder : 9999,
      scheduleConfig: template.scheduleConfig || null,
      isActive: true,
      updatedAt: now
    };

    const exists = existingKeys.has(template.key);

    if (exists) {
      batch.set(docRef, docData, { merge: true });
      updated += 1;
    } else {
      batch.set(
        docRef,
        {
          ...docData,
          createdAt: now
        },
        { merge: false }
      );
      created += 1;
    }

    opCount += 1;

    if (opCount >= 400) {
      await flushBatch();
    }
  }

  await flushBatch();

  return {
    created,
    updated,
    skipped,
    totalTemplates: templateList.length
  };
}

async function seedCompanyTemplates({ db, companyId, locationId }) {
  if (!db) {
    throw new Error("seedCompanyTemplates kræver db");
  }
  if (!companyId) {
    throw new Error("seedCompanyTemplates kræver companyId");
  }
  if (!locationId) {
    throw new Error("seedCompanyTemplates kræver locationId");
  }

  const results = await Promise.all([
    seedCompanyEgenkontrolProgramsFromTemplates({ db, companyId, locationId, overwriteExisting: true }),
    seedCompanyRecallTemplates({ db, companyId, locationId, overwriteExisting: true })
  ]);

  return {
    programs: results[0],
    recalls: results[1]
  };
}

async function seedCompanyRecallTemplates({ db, companyId, locationId, overwriteExisting = false }) {
  if (!db) {
    throw new Error("seedCompanyRecallTemplates kræver db");
  }
  if (!companyId) {
    throw new Error("seedCompanyRecallTemplates kræver companyId");
  }
  if (!locationId) {
    throw new Error("seedCompanyRecallTemplates kræver locationId");
  }

  const { GLOBAL_RECALL_AUTO_TEMPLATES } = require("./recallAutoTemplates");

  const now = admin.firestore.FieldValue.serverTimestamp();
  const collectionRef = db
    .collection("companies")
    .doc(companyId)
    .collection("locations")
    .doc(locationId)
    .collection("recall_templates");

  const templateList = Array.isArray(GLOBAL_RECALL_AUTO_TEMPLATES) ? GLOBAL_RECALL_AUTO_TEMPLATES : [];
  if (!templateList.length) {
    return {
      created: 0,
      updated: 0,
      skipped: 0,
      totalTemplates: 0
    };
  }

  const existingSnapshot = await collectionRef.get();
  const existingKeys = new Set(existingSnapshot.docs.map((doc) => doc.id));

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let batch = db.batch();
  let opCount = 0;

  const flushBatch = async () => {
    if (opCount === 0) return;
    await batch.commit();
    batch = db.batch();
    opCount = 0;
  };

  for (const template of templateList) {
    if (!template || !template.key) {
      skipped += 1;
      continue;
    }

    const docRef = collectionRef.doc(template.key);
    const docData = {
      templateKey: template.key,
      title: template.title || "",
      introText: template.introText || "",
      fields: Array.isArray(template.fields) ? template.fields : [],
      sortOrder: Number.isFinite(template.sortOrder) ? template.sortOrder : 9999,
      scheduleConfig: template.scheduleConfig || null,
      isActive: true,
      updatedAt: now
    };

    const exists = existingKeys.has(template.key);

    if (exists) {
      batch.set(docRef, docData, { merge: true });
      updated += 1;
    } else {
      batch.set(
        docRef,
        {
          ...docData,
          createdAt: now
        },
        { merge: false }
      );
      created += 1;
    }

    opCount += 1;

    if (opCount >= 400) {
      await flushBatch();
    }
  }

  await flushBatch();

  return {
    created,
    updated,
    skipped,
    totalTemplates: templateList.length
  };
}

async function seedCompanyTemplates({ db, companyId, locationId }) {
  if (!db) {
    throw new Error("seedCompanyTemplates kræver db");
  }
  if (!companyId) {
    throw new Error("seedCompanyTemplates kræver companyId");
  }
  if (!locationId) {
    throw new Error("seedCompanyTemplates kræver locationId");
  }

  const results = await Promise.all([
    seedCompanyEgenkontrolProgramsFromTemplates({ db, companyId, locationId, overwriteExisting: true }),
    seedCompanyRecallTemplates({ db, companyId, locationId, overwriteExisting: true })
  ]);

  return {
    programs: results[0],
    recalls: results[1]
  };
}

async function seedCompanyRecallTemplates({ db, companyId, locationId, overwriteExisting = false }) {
  if (!db) {
    throw new Error("seedCompanyRecallTemplates kræver db");
  }
  if (!companyId) {
    throw new Error("seedCompanyRecallTemplates kræver companyId");
  }
  if (!locationId) {
    throw new Error("seedCompanyRecallTemplates kræver locationId");
  }

  const { GLOBAL_RECALL_AUTO_TEMPLATES } = require("./recallAutoTemplates");

  const now = admin.firestore.FieldValue.serverTimestamp();
  const collectionRef = db
    .collection("companies")
    .doc(companyId)
    .collection("locations")
    .doc(locationId)
    .collection("recall_templates");

  const templateList = Array.isArray(GLOBAL_RECALL_AUTO_TEMPLATES) ? GLOBAL_RECALL_AUTO_TEMPLATES : [];
  if (!templateList.length) {
    return {
      created: 0,
      updated: 0,
      skipped: 0,
      totalTemplates: 0
    };
  }

  const existingSnapshot = await collectionRef.get();
  const existingKeys = new Set(existingSnapshot.docs.map((doc) => doc.id));

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let batch = db.batch();
  let opCount = 0;

  const flushBatch = async () => {
    if (opCount === 0) return;
    await batch.commit();
    batch = db.batch();
    opCount = 0;
  };

  for (const template of templateList) {
    if (!template || !template.key) {
      skipped += 1;
      continue;
    }

    const docRef = collectionRef.doc(template.key);
    const docData = {
      templateKey: template.key,
      title: template.title || "",
      introText: template.introText || "",
      fields: Array.isArray(template.fields) ? template.fields : [],
      sortOrder: Number.isFinite(template.sortOrder) ? template.sortOrder : 9999,
      scheduleConfig: template.scheduleConfig || null,
      isActive: true,
      updatedAt: now
    };

    const exists = existingKeys.has(template.key);

    if (exists) {
      batch.set(docRef, docData, { merge: true });
      updated += 1;
    } else {
      batch.set(
        docRef,
        {
          ...docData,
          createdAt: now
        },
        { merge: false }
      );
      created += 1;
    }

    opCount += 1;

    if (opCount >= 400) {
      await flushBatch();
    }
  }

  await flushBatch();

  return {
    created,
    updated,
    skipped,
    totalTemplates: templateList.length
  };
}

async function seedCompanyTemplates({ db, companyId, locationId }) {
  if (!db) {
    throw new Error("seedCompanyTemplates kræver db");
  }
  if (!companyId) {
    throw new Error("seedCompanyTemplates kræver companyId");
  }
  if (!locationId) {
    throw new Error("seedCompanyTemplates kræver locationId");
  }

  const results = await Promise.all([
    seedCompanyEgenkontrolProgramsFromTemplates({ db, companyId, locationId, overwriteExisting: true }),
    seedCompanyRecallTemplates({ db, companyId, locationId, overwriteExisting: true })
  ]);

  return {
    programs: results[0],
    recalls: results[1]
  };
}

module.exports = {
  buildCompanyProgramDoc,
  seedCompanyEgenkontrolProgramsFromTemplates,
  seedCompanyTemplates
};