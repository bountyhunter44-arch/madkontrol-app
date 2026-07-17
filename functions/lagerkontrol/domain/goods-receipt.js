const { normalizeInventoryQuantity } = require("./quantity");
const { findOrCreateInventoryItem } = require("./product-match");
const { buildInventoryMovement } = require("./inventory-movement");

async function receiveGoods({ firestore, payload, uid }) {
  const now = firestore.serverTimestamp();
  const companyId = payload.companyId;
  const locationId = payload.locationId;
  const normalized = normalizeInventoryQuantity(payload.extracted);
  const item = await findOrCreateInventoryItem({ firestore, companyId, locationId, payload, normalized, now, uid });
  const price = Number(payload.extracted.price || 0);
  const pricePerNormalizedUnit = normalized.normalizedQuantity > 0 ? price / normalized.normalizedQuantity : 0;

  const batchDoc = {
    companyId,
    locationId,
    inventoryItemId: item.id,
    productName: payload.extracted.productName,
    supplier: payload.extracted.supplier || "",
    batchNumber: payload.extracted.batchNumber || "",
    expiryDate: payload.extracted.expiryDate || "",
    category: payload.extracted.category || item.category || "kolonial",
    quantity: normalized.quantity,
    originalQuantity: normalized.originalQuantity,
    originalUnit: normalized.originalUnit,
    packageUnit: normalized.packageUnit,
    packageSize: normalized.packageSize,
    packageSizeUnit: normalized.packageSizeUnit,
    unitsPerPackage: normalized.unitsPerPackage,
    normalizedQuantity: normalized.normalizedQuantity,
    remainingNormalizedQuantity: normalized.normalizedQuantity,
    normalizedUnit: normalized.normalizedUnit,
    unitType: normalized.unitType,
    baseUnit: normalized.baseUnit,
    price,
    pricePerNormalizedUnit,
    source: payload.source,
    taskEntryId: payload.taskEntryId || "",
    photoUrl: payload.photoUrl || "",
    documentUrl: payload.documentUrl || "",
    createdBy: uid,
    updatedBy: uid,
    createdAt: now,
    updatedAt: now
  };

  const receiptDoc = {
    ...batchDoc,
    haccp: payload.haccp,
    evidence: {
      photoUrl: payload.photoUrl || "",
      documentUrl: payload.documentUrl || "",
      ocrText: payload.ocrText || ""
    },
    extracted: payload.extracted,
    normalized: {
      quantity: normalized.normalizedQuantity,
      unit: normalized.normalizedUnit,
      display: normalized.display,
      totalCl: normalized.totalCl,
      calculatedBottles: normalized.calculatedBottles
    }
  };

  const batchRef = await firestore.companyCollection(companyId, "lager_inventory_batches").add(batchDoc);
  const receiptRef = await firestore.companyCollection(companyId, "lager_goods_receipts").add({
    ...receiptDoc,
    batchId: batchRef.id,
    inventoryItemId: item.id
  });
  const movementDoc = buildInventoryMovement({
    companyId,
    locationId,
    payload,
    item,
    batchId: batchRef.id,
    normalized,
    now,
    uid
  });
  const movementRef = await firestore.companyCollection(companyId, "lager_inventory_movements").add({
    ...movementDoc,
    goodsReceiptId: receiptRef.id
  });

  await firestore.companyCollection(companyId, "lager_inventory_items").doc(item.id).set({
    currentQuantity: firestore.increment(normalized.normalizedQuantity),
    normalizedQuantity: firestore.increment(normalized.normalizedQuantity),
    normalizedUnit: normalized.normalizedUnit,
    unitType: normalized.unitType,
    baseUnit: normalized.baseUnit,
    supplier: payload.extracted.supplier || item.supplier || "",
    pricePerNormalizedUnit: pricePerNormalizedUnit || item.pricePerNormalizedUnit || 0,
    purchasePrice: price || item.purchasePrice || 0,
    updatedBy: uid,
    updatedAt: now
  }, { merge: true });

  return {
    ok: true,
    goodsReceiptId: receiptRef.id,
    inventoryItemId: item.id,
    batchId: batchRef.id,
    movementId: movementRef.id,
    normalized: {
      quantity: normalized.normalizedQuantity,
      unit: normalized.normalizedUnit,
      display: normalized.display,
      totalCl: normalized.totalCl,
      calculatedBottles: normalized.calculatedBottles
    }
  };
}

module.exports = {
  receiveGoods
};
