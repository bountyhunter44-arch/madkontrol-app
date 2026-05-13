const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

(async () => {
  try {
    const docId = 'cuxm0Qy9dMRcR6bYosjT';
    
    console.log(`\n📖 Reading haccp_snapshots/${docId}...\n`);
    
    const docRef = db.collection('haccp_snapshots').doc(docId);
    const docSnap = await docRef.get();
    
    if (!docSnap.exists) {
      console.error('❌ Document not found');
      process.exit(1);
    }
    
    const data = docSnap.data();
    
    console.log('companyId:', data.companyId);
    console.log('locationId:', data.locationId);
    console.log('version:', data.version);
    console.log('updatedAt:', data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt);
    console.log('controlPoints.length:', data.controlPoints?.length || 0);
    console.log('controlPoints[0].key:', data.controlPoints?.[0]?.key || 'N/A');
    console.log('controlPoints[0].title:', data.controlPoints?.[0]?.title || 'N/A');
    
    console.log('\n📋 All controlPoints keys:');
    if (data.controlPoints && Array.isArray(data.controlPoints)) {
      data.controlPoints.forEach((cp, idx) => {
        console.log(`  [${idx}] ${cp.key} - ${cp.title} (${cp.type})`);
      });
    } else {
      console.log('  No controlPoints found');
    }
    
    console.log('\n✅ Done\n');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
})();
