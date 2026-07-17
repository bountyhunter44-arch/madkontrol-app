const admin = require("firebase-admin");
const { onCall } = require("firebase-functions/v2/https");
const { createLagerFirestoreAdapter } = require("./adapters/firestore");
const { createLagerApi } = require("./api");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

const firestore = createLagerFirestoreAdapter({
  db,
  FieldValue: admin.firestore.FieldValue
});

const api = createLagerApi({ firestore });

exports.lagerReceiveGoods = onCall(
  { region: "us-central1" },
  api.lagerReceiveGoodsHandler
);

Object.assign(exports, require("./ocr"));
