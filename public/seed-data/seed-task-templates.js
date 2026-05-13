const admin = require("firebase-admin");
const serviceAccount = require("D:/madkontrol-app/serviceAccountKey.json");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: "madkontrollen"
  });
}

const db = admin.firestore();

const templates = [
  {
    id: "tpl_temperature_fridge",
    organizationId: "company_1",
    locationId: "location_1",
    taskId: "temperature_fridge",
    title: "Temperaturkontrol køleskab",
    description: "Kontrollér at køleskabet holder korrekt temperatur.",
    category: "temperature",
    frequency: "daily",
    entryType: "measurement",
    valueType: "number",
    unit: "°C",
    requiresPhoto: false,
    requiresComment: false,
    isActive: true,
    sortOrder: 10
  },
  {
    id: "tpl_freezer_temperature",
    organizationId: "company_1",
    locationId: "location_1",
    taskId: "freezer_temperature",
    title: "Temperaturkontrol fryser",
    description: "Kontrollér at fryseren holder korrekt temperatur.",
    category: "temperature",
    frequency: "daily",
    entryType: "measurement",
    valueType: "number",
    unit: "°C",
    requiresPhoto: false,
    requiresComment: false,
    isActive: true,
    sortOrder: 20
  },
  {
    id: "tpl_cleaning_opening",
    organizationId: "company_1",
    locationId: "location_1",
    taskId: "cleaning_opening",
    title: "Rengøring og klargøring",
    description: "Gennemgå kontaktflader, stationer og åbne-rutiner før service.",
    category: "cleaning",
    frequency: "daily",
    entryType: "check",
    valueType: "boolean",
    unit: null,
    requiresPhoto: false,
    requiresComment: false,
    isActive: true,
    sortOrder: 30
  },
  {
    id: "tpl_receiving_control",
    organizationId: "company_1",
    locationId: "location_1",
    taskId: "receiving_control",
    title: "Modtagekontrol",
    description: "Kontrollér varer, emballage og temperatur ved modtagelse.",
    category: "receiving",
    frequency: "daily",
    entryType: "check",
    valueType: "boolean",
    unit: null,
    requiresPhoto: false,
    requiresComment: true,
    isActive: true,
    sortOrder: 40
  },
  {
    id: "tpl_closing_routine",
    organizationId: "company_1",
    locationId: "location_1",
    taskId: "closing_routine",
    title: "Lukkerutiner",
    description: "Afslut dagen med lukkerutiner, kontrol og signering.",
    category: "closing",
    frequency: "daily",
    entryType: "check",
    valueType: "boolean",
    unit: null,
    requiresPhoto: false,
    requiresComment: false,
    isActive: true,
    sortOrder: 50
  }
];

async function seedTaskTemplates() {
  const batch = db.batch();

  for (const template of templates) {
    const ref = db.collection("task_templates").doc(template.id);
    batch.set(ref, {
      ...template,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  }

  await batch.commit();
  console.log(`Seedet ${templates.length} task templates.`);
  process.exit(0);
}

seedTaskTemplates().catch((error) => {
  console.error("Fejl ved seed af task_templates:", error);
  process.exit(1);
});