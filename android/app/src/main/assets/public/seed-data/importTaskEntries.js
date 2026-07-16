const admin = require("firebase-admin");
const path = require("path");

const serviceAccount = require(path.join(__dirname, "../../serviceAccountKey.json"));

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

function getTodayKey() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

async function run() {
    try {
        console.log("Importerer task_entries...");

        const today = getTodayKey();

        const entries = [
            {
                organizationId: "ctpvcnJPqrVVL8I7AKbq",
                locationId: "LnZi9tb1rVF4msjTAdIf",
                module: "egenkontrol",
                taskId: "temperature_fridge",
                taskInstanceId: null,
                userId: "user-1",
                userName: "Medarbejder",
                signedBy: "user-1",
                signedByName: "Medarbejder",
                entryType: "measurement",
                valueNumber: 4,
                valueText: null,
                valueBoolean: null,
                valueOption: null,
                unit: "°C",
                comment: "Temperatur OK",
                status: "ok",
                actionType: "save",
                dateKey: today,
                sourceType: "seed",
                sourceId: "seed-temperature-fridge"
            },
            {
                organizationId: "ctpvcnJPqrVVL8I7AKbq",
                locationId: "LnZi9tb1rVF4msjTAdIf",
                module: "egenkontrol",
                taskId: "freezer_temperature",
                taskInstanceId: null,
                userId: "user-1",
                userName: "Medarbejder",
                signedBy: "user-1",
                signedByName: "Medarbejder",
                entryType: "measurement",
                valueNumber: -18,
                valueText: null,
                valueBoolean: null,
                valueOption: null,
                unit: "°C",
                comment: "Fryser OK",
                status: "ok",
                actionType: "save",
                dateKey: today,
                sourceType: "seed",
                sourceId: "seed-freezer-temperature"
            },
            {
                organizationId: "ctpvcnJPqrVVL8I7AKbq",
                locationId: "LnZi9tb1rVF4msjTAdIf",
                module: "egenkontrol",
                taskId: "opening_check",
                taskInstanceId: null,
                userId: "user-1",
                userName: "Medarbejder",
                signedBy: "user-1",
                signedByName: "Medarbejder",
                entryType: "check",
                valueNumber: null,
                valueText: "Åbning udført",
                valueBoolean: true,
                valueOption: null,
                unit: null,
                comment: "Åbning udført",
                status: "ok",
                actionType: "save",
                dateKey: today,
                sourceType: "seed",
                sourceId: "seed-opening-check"
            }
        ];

        for (const entry of entries) {
            const ref = await db.collection("task_entries").add({
                ...entry,
                signedAt: admin.firestore.FieldValue.serverTimestamp(),
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            console.log("Importeret task_entry:", ref.id);
        }

        console.log("Alle task_entries er importeret.");
    } catch (error) {
        console.error("Fejl i importTaskEntries.js:", error);
        process.exitCode = 1;
    }
}

run();