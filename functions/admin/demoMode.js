/**
 * Demo Mode - Safe alternative to data reset
 * Creates isolated demo data that doesn't affect production data
 */

const admin = require("firebase-admin");
const { FieldValue } = admin.firestore;

/**
 * Create demo company with isolated data
 */
async function createDemoCompany({ userId, companyName }) {
  const db = admin.firestore();
  
  const demoCompanyRef = db.collection("companies").doc();
  const demoLocationRef = db.collection("locations").doc();
  
  const demoCompanyData = {
    id: demoCompanyRef.id,
    name: companyName || "Demo Restaurant",
    prettyName: companyName || "Demo Restaurant",
    displayName: companyName || "Demo Restaurant",
    address: "Demovej 1",
    street: "Demovej 1",
    streetAddress: "Demovej 1",
    zip: "4300",
    postalCode: "4300",
    zipcode: "4300",
    city: "Holbæk",
    town: "Holbæk",
    phone: "12 34 56 78",
    phoneNumber: "12 34 56 78",
    contactPhone: "12 34 56 78",
    companyPhone: "12 34 56 78",
    isDemo: true,
    demoMode: true,
    demoCreatedAt: FieldValue.serverTimestamp(),
    demoCreatedBy: userId,
    demoExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    status: "active",
    createdAt: FieldValue.serverTimestamp()
  };
  
  const demoLocationData = {
    id: demoLocationRef.id,
    companyId: demoCompanyRef.id,
    name: "Hovedlokation",
    prettyName: "Hovedlokation",
    displayName: "Hovedlokation",
    locationName: "Hovedlokation",
    address: "Demovej 1",
    street: "Demovej 1",
    streetAddress: "Demovej 1",
    zip: "4300",
    postalCode: "4300",
    zipcode: "4300",
    city: "Holbæk",
    town: "Holbæk",
    phone: "12 34 56 78",
    phoneNumber: "12 34 56 78",
    contactPhone: "12 34 56 78",
    isDemo: true,
    demoMode: true,
    demoCreatedAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp()
  };
  
  await demoCompanyRef.set(demoCompanyData);
  await demoLocationRef.set(demoLocationData);
  
  return {
    companyId: demoCompanyRef.id,
    locationId: demoLocationRef.id
  };
}

/**
 * Clean up expired demo data
 */
async function cleanupExpiredDemoData() {
  const db = admin.firestore();
  const now = new Date();
  
  // Find expired demo companies
  const expiredCompanies = await db.collection("companies")
    .where("isDemo", "==", true)
    .where("demoExpiresAt", "<", now)
    .get();
  
  const batch = db.batch();
  let count = 0;
  
  for (const doc of expiredCompanies.docs) {
    // Delete company
    batch.delete(doc.ref);
    count++;
    
    // Delete associated locations
    const locations = await db.collection("locations")
      .where("companyId", "==", doc.id)
      .get();
    
    locations.docs.forEach(locDoc => {
      batch.delete(locDoc.ref);
      count++;
    });
    
    // Delete associated task instances
    const tasks = await db.collection("task_instances")
      .where("companyId", "==", doc.id)
      .get();
    
    tasks.docs.forEach(taskDoc => {
      batch.delete(taskDoc.ref);
      count++;
    });
  }
  
  if (count > 0) {
    await batch.commit();
  }
  
  return { deletedCount: count };
}

/**
 * Switch user to demo mode
 */
async function enableDemoMode({ userId, userData }) {
  const db = admin.firestore();
  
  // Create demo company
  const demo = await createDemoCompany({ userId, companyName: "Demo Restaurant" });
  
  // Update user to use demo company
  await db.collection("users").doc(userId).update({
    demoMode: true,
    isDemo: true,
    demoCompanyId: demo.companyId,
    demoLocationId: demo.locationId,
    companyId: demo.companyId,
    locationId: demo.locationId,
    primaryLocationId: demo.locationId,
    locationIds: [demo.locationId],
    companyName: "Demo Restaurant",
    locationName: "Hovedlokation",
    address: "Demovej 1",
    street: "Demovej 1",
    zip: "4300",
    postalCode: "4300",
    city: "Holbæk",
    town: "Holbæk",
    phone: "12 34 56 78",
    phoneNumber: "12 34 56 78",
    contactPhone: "12 34 56 78",
    originalCompanyId: userData.companyId,
    originalLocationId: userData.locationId,
    originalCompanyName: userData.companyName,
    originalLocationName: userData.locationName,
    originalAddress: userData.address,
    originalPhone: userData.phone,
    updatedAt: FieldValue.serverTimestamp()
  });
  
  return demo;
}

/**
 * Switch user back to production mode
 */
async function disableDemoMode({ userId, userData }) {
  const db = admin.firestore();
  
  await db.collection("users").doc(userId).update({
    demoMode: false,
    isDemo: false,
    companyId: userData.originalCompanyId,
    locationId: userData.originalLocationId,
    primaryLocationId: userData.originalLocationId,
    companyName: userData.originalCompanyName || admin.firestore.FieldValue.delete(),
    locationName: userData.originalLocationName || admin.firestore.FieldValue.delete(),
    address: userData.originalAddress || admin.firestore.FieldValue.delete(),
    phone: userData.originalPhone || admin.firestore.FieldValue.delete(),
    demoCompanyId: admin.firestore.FieldValue.delete(),
    demoLocationId: admin.firestore.FieldValue.delete(),
    originalCompanyId: admin.firestore.FieldValue.delete(),
    originalLocationId: admin.firestore.FieldValue.delete(),
    originalCompanyName: admin.firestore.FieldValue.delete(),
    originalLocationName: admin.firestore.FieldValue.delete(),
    originalAddress: admin.firestore.FieldValue.delete(),
    originalPhone: admin.firestore.FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp()
  });
  
  return { success: true };
}

module.exports = {
  createDemoCompany,
  cleanupExpiredDemoData,
  enableDemoMode,
  disableDemoMode
};
