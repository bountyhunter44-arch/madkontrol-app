# FILE: public/scripts/fix-modtagekontrol.cjs

```javascript
/**
 * Fix Modtagekontrol template - update guideKey and controlType to receiving_goods
 */

const admin = require('firebase-admin');
const path = require('path');

if (!admin.apps.length) {
    const serviceAccount = require(path.join(__dirname, '../../serviceAccountKey.json'));
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function fixModtagekontrol() {
    console.log('\n=== FIXING MODTAGEKONTROL ===\n');
    
    const templateRef = db.collection('task_templates').doc('tpl_receiving_control');
    
    await templateRef.update({
        guideKey: 'receiving_goods',
        controlType: 'receiving_goods',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('✅ Updated template tpl_receiving_control\n');
    console.log('   Old GuideKey: cleaning_control');
    console.log('   New GuideKey: receiving_goods');
    console.log('   Old ControlType: cleaning_control');
    console.log('   New ControlType: receiving_goods\n');
    
    console.log('=== NEXT STEP ===\n');
    console.log('Regenerate task_instances to apply the fix\n');
    
    process.exit(0);
}

fixModtagekontrol().catch(error => {
    console.error('Error:', error);
    process.exit(1);
});

```
