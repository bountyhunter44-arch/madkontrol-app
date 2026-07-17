function createLagerFirestoreAdapter({ db, FieldValue }) {
  function companyCollection(companyId, name) {
    return db.collection("companies").doc(companyId).collection(name);
  }

  async function findInventoryItemByName({ companyId, locationId, normalizedName }) {
    const snap = await companyCollection(companyId, "lager_inventory_items")
      .where("locationId", "==", locationId)
      .where("normalizedName", "==", normalizedName)
      .limit(1)
      .get();

    if (snap.empty) return null;
    const doc = snap.docs[0];
    return { id: doc.id, ...doc.data() };
  }

  async function getUserProfile(uid) {
    const snap = await db.collection("users").doc(uid).get();
    return snap.exists ? { id: snap.id, ...snap.data() } : null;
  }

  async function runTransaction(handler) {
    return db.runTransaction(handler);
  }

  function serverTimestamp() {
    return FieldValue.serverTimestamp();
  }

  function increment(value) {
    return FieldValue.increment(value);
  }

  return {
    companyCollection,
    findInventoryItemByName,
    getUserProfile,
    runTransaction,
    serverTimestamp,
    increment
  };
}

module.exports = {
  createLagerFirestoreAdapter
};
