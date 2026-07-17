function buildInventoryMovement({ companyId, locationId, payload, item, batchId, normalized, now, uid }) {
  const price = Number(payload.extracted.price || 0);
  return {
    companyId,
    locationId,
    type: "goods_receipt",
    source: payload.source,
    taskEntryId: payload.taskEntryId || "",
    inventoryItemId: item.id,
    batchId,
    productName: payload.extracted.productName,
    quantity: normalized.normalizedQuantity,
    normalizedQuantity: normalized.normalizedQuantity,
    normalizedUnit: normalized.normalizedUnit,
    unitType: normalized.unitType,
    value: price,
    pricePerNormalizedUnit: normalized.normalizedQuantity > 0 ? price / normalized.normalizedQuantity : 0,
    createdBy: uid,
    updatedBy: uid,
    createdAt: now,
    updatedAt: now
  };
}

module.exports = {
  buildInventoryMovement
};
