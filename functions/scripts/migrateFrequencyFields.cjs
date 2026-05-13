/**
 * Migration Script: Sync Frequency Fields with scheduleConfig
 * 
 * Dette script retter eksisterende task_templates hvor frequency-felter
 * ikke matcher scheduleConfig, så UI og backend bliver enige.
 * 
 * Kør:
 *   node functions/scripts/migrateFrequencyFields.cjs --dry-run
 *   node functions/scripts/migrateFrequencyFields.cjs --execute
 * 
 * Flags:
 *   --dry-run   : Vis hvad der ville blive ændret (ingen writes)
 *   --execute   : Udfør faktiske ændringer
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Service Account Path (i projekt-roden)
const SERVICE_ACCOUNT_PATH = 'D:\\madkontrol-app\\serviceAccountKey.json';

// Initialize Firebase Admin
function initFirebase() {
  if (admin.apps.length) return;

  if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    throw new Error(`Service account ikke fundet: ${SERVICE_ACCOUNT_PATH}`);
  }

  const serviceAccount = require(SERVICE_ACCOUNT_PATH);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  console.log(`[initFirebase] Service account: ${SERVICE_ACCOUNT_PATH}`);
  console.log(`[initFirebase] PROJECT: ${serviceAccount.project_id}`);
}

// Initialize
initFirebase();

const db = admin.firestore();

// ============================================================================
// FREQUENCY MAPPING LOGIC
// ============================================================================

function getFrequencyFromScheduleConfig(scheduleConfig) {
  if (!scheduleConfig) return null;

  const mode = scheduleConfig.recurrenceMode;
  const value = scheduleConfig.recurrenceValue;

  if (mode === 'every_n_days') {
    if (value === 1) {
      return {
        frequency: 'daily',
        frequencyType: 'daily',
        frequencyDays: 1,
        interval_days: 1
      };
    } else if (value === 7) {
      return {
        frequency: 'weekly',
        frequencyType: 'interval_days',
        frequencyDays: 7,
        interval_days: 7
      };
    } else if (value === 14) {
      return {
        frequency: 'every_14_days',
        frequencyType: 'interval_days',
        frequencyDays: 14,
        interval_days: 14
      };
    } else if (value === 30) {
      return {
        frequency: 'monthly',
        frequencyType: 'interval_days',
        frequencyDays: 30,
        interval_days: 30
      };
    } else if (value === 365) {
      return {
        frequency: 'yearly',
        frequencyType: 'interval_days',
        frequencyDays: 365,
        interval_days: 365
      };
    }
  }

  // Hvis vi ikke kan mappe sikkert, returner null
  return null;
}

function needsUpdate(doc) {
  const data = doc.data();
  const scheduleConfig = data.scheduleConfig;

  // Hvis scheduleConfig mangler, kan vi ikke rette sikkert
  if (!scheduleConfig) return false;

  const expectedFreq = getFrequencyFromScheduleConfig(scheduleConfig);
  
  // Hvis vi ikke kan mappe sikkert, skip
  if (!expectedFreq) return false;

  // Check om nogen felter er forkerte eller mangler
  const needsFrequency = data.frequency !== expectedFreq.frequency;
  const needsFrequencyType = data.frequencyType !== expectedFreq.frequencyType;
  const needsFrequencyDays = data.frequencyDays !== expectedFreq.frequencyDays;
  const needsIntervalDays = data.interval_days !== expectedFreq.interval_days;

  return needsFrequency || needsFrequencyType || needsFrequencyDays || needsIntervalDays;
}

// ============================================================================
// MIGRATION LOGIC
// ============================================================================

async function migrateTaskTemplates(dryRun = true) {
  console.log('\n========================================');
  console.log('FREQUENCY FIELD MIGRATION');
  console.log('========================================\n');
  console.log(`Mode: ${dryRun ? 'DRY RUN (no writes)' : 'EXECUTE (writing changes)'}\n`);

  let totalDocs = 0;
  let updatedDocs = 0;
  let skippedDocs = 0;
  let uncertainDocs = 0;

  const examples = [];

  try {
    const snapshot = await db.collection('task_templates').get();
    totalDocs = snapshot.size;

    console.log(`Found ${totalDocs} task_templates\n`);

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const scheduleConfig = data.scheduleConfig;

      // Skip hvis scheduleConfig mangler
      if (!scheduleConfig) {
        uncertainDocs++;
        console.log(`⚠️  UNCERTAIN: ${doc.id} - No scheduleConfig`);
        continue;
      }

      const expectedFreq = getFrequencyFromScheduleConfig(scheduleConfig);

      // Skip hvis vi ikke kan mappe sikkert
      if (!expectedFreq) {
        uncertainDocs++;
        console.log(`⚠️  UNCERTAIN: ${doc.id} - Cannot map scheduleConfig safely`);
        console.log(`    scheduleConfig:`, JSON.stringify(scheduleConfig));
        continue;
      }

      // Check om opdatering er nødvendig
      if (!needsUpdate(doc)) {
        skippedDocs++;
        continue;
      }

      // Log ændring
      const change = {
        id: doc.id,
        title: data.title || 'N/A',
        old: {
          frequency: data.frequency,
          frequencyType: data.frequencyType,
          frequencyDays: data.frequencyDays,
          interval_days: data.interval_days
        },
        scheduleConfig: scheduleConfig,
        new: expectedFreq
      };

      console.log(`✏️  UPDATE: ${doc.id}`);
      console.log(`    Title: ${change.title}`);
      console.log(`    Old frequency: ${change.old.frequency || 'null'}`);
      console.log(`    New frequency: ${change.new.frequency}`);
      console.log(`    scheduleConfig: mode=${scheduleConfig.recurrenceMode}, value=${scheduleConfig.recurrenceValue}`);

      if (examples.length < 5) {
        examples.push(change);
      }

      // Udfør opdatering hvis ikke dry run
      if (!dryRun) {
        await doc.ref.update({
          frequency: expectedFreq.frequency,
          frequencyType: expectedFreq.frequencyType,
          frequencyDays: expectedFreq.frequencyDays,
          interval_days: expectedFreq.interval_days,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      updatedDocs++;
    }

    // Summary
    console.log('\n========================================');
    console.log('MIGRATION SUMMARY');
    console.log('========================================\n');
    console.log(`Total documents:     ${totalDocs}`);
    console.log(`Updated:             ${updatedDocs}`);
    console.log(`Skipped (correct):   ${skippedDocs}`);
    console.log(`Uncertain (skipped): ${uncertainDocs}`);
    console.log(`\nMode: ${dryRun ? 'DRY RUN - No changes written' : 'EXECUTE - Changes written to Firestore'}`);

    if (examples.length > 0) {
      console.log('\n========================================');
      console.log('EXAMPLE CHANGES');
      console.log('========================================\n');
      examples.forEach((ex, i) => {
        console.log(`Example ${i + 1}:`);
        console.log(`  ID: ${ex.id}`);
        console.log(`  Title: ${ex.title}`);
        console.log(`  Old: frequency=${ex.old.frequency}, days=${ex.old.frequencyDays}`);
        console.log(`  New: frequency=${ex.new.frequency}, days=${ex.new.frequencyDays}`);
        console.log('');
      });
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = !args.includes('--execute');

  if (isDryRun && !args.includes('--dry-run')) {
    console.log('⚠️  No flag specified. Use --dry-run or --execute');
    console.log('   Running in DRY RUN mode by default\n');
  }

  await migrateTaskTemplates(isDryRun);

  console.log('\n✅ Migration complete\n');
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
