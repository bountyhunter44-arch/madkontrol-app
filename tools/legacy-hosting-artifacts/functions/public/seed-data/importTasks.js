const admin = require("firebase-admin");
const path = require("path");

const serviceAccount = require(path.join(__dirname, "../../serviceAccountKey.json"));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

const organizationId = "ctpvcnJPqrVVL8I7AKbq";
const locationId = "LnZi9tb1rVF4msjTAdIf";

const tasks = [
  {
    taskId: "opening_check",
    module: "egenkontrol",
    title: "Åbningskontrol",
    description: "Udfør åbningskontrol før opstart.",
    category: "Åbning",
    taskType: "routine",
    entryType: "check",
    equipmentName: "",
    equipmentType: "",
    frequency: "daily",
    requiresDocumentation: true,
    isActive: true,
    sortOrder: 1
  },
  {
    taskId: "temperature_fridge",
    module: "egenkontrol",
    title: "Temperaturkontrol køleskab",
    description: "Registrer temperatur i køleskab.",
    category: "Temperatur",
    taskType: "routine",
    entryType: "measurement",
    equipmentName: "Køleskab 1",
    equipmentType: "fridge",
    frequency: "daily",
    unit: "°C",
    placeholder: "Fx 4",
    requiresDocumentation: true,
    isActive: true,
    sortOrder: 2
  },
  {
    taskId: "freezer_temperature",
    module: "egenkontrol",
    title: "Temperaturkontrol fryser",
    description: "Registrer temperatur i fryser.",
    category: "Temperatur",
    taskType: "routine",
    entryType: "measurement",
    equipmentName: "Fryser 1",
    equipmentType: "freezer",
    frequency: "daily",
    unit: "°C",
    placeholder: "Fx -20",
    requiresDocumentation: true,
    isActive: true,
    sortOrder: 3
  },
  {
    taskId: "cleaning_daily",
    module: "egenkontrol",
    title: "Daglig rengøring",
    description: "Kontrollér at dagens rengøring er udført.",
    category: "Rengøring",
    taskType: "routine",
    entryType: "check",
    equipmentName: "",
    equipmentType: "",
    frequency: "daily",
    requiresDocumentation: true,
    isActive: true,
    sortOrder: 4
  },
  {
    taskId: "closing_check",
    module: "egenkontrol",
    title: "Lukkekontrol",
    description: "Udfør lukkekontrol ved dagens afslutning.",
    category: "Lukning",
    taskType: "routine",
    entryType: "check",
    equipmentName: "",
    equipmentType: "",
    frequency: "daily",
    requiresDocumentation: true,
    isActive: true,
    sortOrder: 5
  }
];

async function importTasks() {
  try {
    console.log("Importerer tasks...");

    for (const task of tasks) {
      await db.collection("tasks").doc(task.taskId).set({
        organizationId,
        locationId,
        createdBy: "user-1",
        createdByName: "Medarbejder",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        ...task
      }, { merge: true });

      console.log(`Importeret task: ${task.taskId}`);
    }

    console.log("Alle tasks er importeret.");
  } catch (error) {
    console.error("Fejl ved import af tasks:", error);
    process.exitCode = 1;
  }
}

importTasks();