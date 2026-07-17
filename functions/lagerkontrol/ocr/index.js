const admin = require("firebase-admin");
const { defineSecret } = require("firebase-functions/params");
const { onCall } = require("firebase-functions/v2/https");
const { createLagerOcrApi } = require("./api");
const { createFirestoreOcrRepo } = require("./adapters/firestore-ocr-repo");

if (!admin.apps.length) {
  admin.initializeApp();
}

const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");
const db = admin.firestore();
const repo = createFirestoreOcrRepo({
  db,
  FieldValue: admin.firestore.FieldValue
});
const api = createLagerOcrApi({ repo, openAiApiKeySecret: OPENAI_API_KEY });

exports.lagerProcessSupplierDocument = onCall(
  { region: "us-central1", secrets: [OPENAI_API_KEY], timeoutSeconds: 120, memory: "512MiB" },
  api.lagerProcessSupplierDocumentHandler
);
