const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

const emails = [
  'mn@aroid.dk',
  'sara@madkontrollen.dk',
  'michael@madkontrollen.dk',
  'jonas@madkontrollen.dk'
];

async function run() {
  for (const email of emails) {
    try {
      const authUser = await admin.auth().getUserByEmail(email);
      const uid = authUser.uid;

      const uidRef = db.collection('users').doc(uid);
      const uidSnap = await uidRef.get();
      if (uidSnap.exists) {
        console.log('UID_DOC_EXISTS', email, uid);
        continue;
      }

      const byEmail = await db.collection('users').where('email', '==', email).limit(1).get();
      if (byEmail.empty) {
        console.log('NO_EMAIL_PROFILE', email, uid);
        continue;
      }

      const sourceDoc = byEmail.docs[0];
      const sourceData = sourceDoc.data() || {};

      await uidRef.set(
        {
          ...sourceData,
          email,
          authUid: uid,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          createdAt: sourceData.createdAt || admin.firestore.FieldValue.serverTimestamp()
        },
        { merge: true }
      );

      console.log('UID_DOC_CREATED', email, uid, 'from', sourceDoc.id);
    } catch (error) {
      console.log('SYNC_FAIL', email, error.message);
    }
  }
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('FAILED', error);
    process.exit(1);
  });
