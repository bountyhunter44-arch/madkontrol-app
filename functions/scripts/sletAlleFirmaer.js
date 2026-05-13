// SLET FRA HER

const admin = require("firebase-admin");
const path = require("path");

// Init Firebase
const serviceAccount = require(path.join(__dirname, "../../serviceAccountKey.json"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function deleteCollectionRecursive(collectionRef) {
  const snapshot = await collectionRef.get();
  for (const doc of snapshot.docs) {
    await deleteDocumentRecursive(doc.ref);
  }
}

async function deleteDocumentRecursive(docRef) {
  const subcollections = await docRef.listCollections();

  for (const sub of subcollections) {
    await deleteCollectionRecursive(sub);
  }

  await docRef.delete();
}

async function main() {
  console.log("======================================");
  console.log("SLETTER ALLE FIRMAER");
  console.log("======================================");

  const companiesSnapshot = await db.collection("companies").get();

  if (companiesSnapshot.empty) {
    console.log("Ingen firmaer fundet.");
    return;
  }

  for (const companyDoc of companiesSnapshot.docs) {
    console.log("Sletter company:", companyDoc.id);

    // Slet subcollections under company
    const subcollections = await companyDoc.ref.listCollections();
    for (const sub of subcollections) {
      console.log("  -> Sletter subcollection:", sub.id);
      await deleteCollectionRecursive(sub);
    }

    // Slet company doc
    await companyDoc.ref.delete();
  }

  console.log("======================================");
  console.log("ALLE FIRMAER SLETTET");
  console.log("======================================");
}

main().catch((err) => {
  console.error("FEJL:", err);
});

// TIL HER