const admin = require("firebase-admin");
const path = require("path");
const serviceAccount = require(path.join(__dirname, "../../serviceAccountKey.json"));

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function run() {
    console.log("Importerer alerts...");

    const alerts = [
        {
            taskId: "fridge-temp",
            locationId: "location-1",
            entryId: "",
            message: "Køleskabstemperatur er for høj",
            severity: "warning",
            resolved: false
        },
        {
            taskId: "freezer-temp",
            locationId: "location-1",
            entryId: "",
            message: "Frysertemperatur kræver kontrol",
            severity: "warning",
            resolved: false
        },
        {
            taskId: "cleaning-check",
            locationId: "location-1",
            entryId: "",
            message: "Rengøringskontrol mangler dokumentation",
            severity: "critical",
            resolved: false
        }
    ];

    try {
        for (const alert of alerts) {
            await db.collection("alerts").add({
                ...alert,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });

            console.log("Oprettet alert:", alert.taskId);
        }

        console.log("Alerts færdig!");
    } catch (error) {
        console.error("Fejl ved import af alerts:", error);
    } finally {
        process.exit();
    }
}

run();