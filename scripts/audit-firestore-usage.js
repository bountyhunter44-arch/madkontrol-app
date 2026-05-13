/**
 * Firestore Usage Audit Script
 * Scans the entire Firestore database and generates a detailed report
 * 
 * Usage: node scripts/audit-firestore-usage.js
 * 
 * Output:
 * - Console report with collection statistics
 * - JSON file: firestore-audit-report.json
 */

import admin from 'firebase-admin';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const MAX_DOCS_TO_SAMPLE = 200;
const MIN_FIELD_COVERAGE = 0.5; // 50% of docs must have a field for it to be considered "common"

// Initialize Firebase Admin
try {
  const serviceAccount = JSON.parse(
    readFileSync('./serviceAccountKey.json', 'utf8')
  );

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });

  console.log('✅ Firebase Admin initialized\n');
} catch (error) {
  console.error('❌ Failed to initialize Firebase Admin');
  console.error('   Make sure serviceAccountKey.json exists in project root');
  process.exit(1);
}

const db = admin.firestore();

/**
 * Get the type of a value
 */
function getValueType(value) {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return 'array';
  if (value instanceof admin.firestore.Timestamp) return 'timestamp';
  if (value instanceof admin.firestore.GeoPoint) return 'geopoint';
  if (typeof value === 'object') return 'object';
  return typeof value;
}

/**
 * Get a safe example value (truncate long strings, simplify objects)
 */
function getSafeExample(value) {
  if (value === null || value === undefined) return value;
  
  if (typeof value === 'string') {
    return value.length > 50 ? value.substring(0, 47) + '...' : value;
  }
  
  if (Array.isArray(value)) {
    return `[${value.length} items]`;
  }
  
  if (value instanceof admin.firestore.Timestamp) {
    return value.toDate().toISOString();
  }
  
  if (typeof value === 'object') {
    return `{${Object.keys(value).length} keys}`;
  }
  
  return value;
}

/**
 * Extract all field paths from a document (including nested fields)
 */
function extractFieldPaths(obj, prefix = '') {
  const fields = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const fieldPath = prefix ? `${prefix}.${key}` : key;
    
    fields[fieldPath] = {
      type: getValueType(value),
      value: getSafeExample(value)
    };
    
    // Recurse into objects (but not arrays or special types)
    if (value && typeof value === 'object' && 
        !Array.isArray(value) && 
        !(value instanceof admin.firestore.Timestamp) &&
        !(value instanceof admin.firestore.GeoPoint)) {
      const nested = extractFieldPaths(value, fieldPath);
      Object.assign(fields, nested);
    }
  }
  
  return fields;
}

/**
 * Analyze a single collection
 */
async function analyzeCollection(collectionName) {
  console.log(`\n📂 Analyzing: ${collectionName}`);
  
  try {
    // Get total count (expensive but accurate)
    const snapshot = await db.collection(collectionName).count().get();
    const totalCount = snapshot.data().count;
    
    console.log(`   📊 Total documents: ${totalCount}`);
    
    if (totalCount === 0) {
      return {
        name: collectionName,
        docCount: 0,
        sampledDocs: 0,
        fields: [],
        status: 'empty'
      };
    }
    
    // Sample documents
    const sampleSize = Math.min(totalCount, MAX_DOCS_TO_SAMPLE);
    const docsSnapshot = await db.collection(collectionName).limit(sampleSize).get();
    
    console.log(`   🔍 Sampling ${sampleSize} documents...`);
    
    // Aggregate field statistics
    const fieldStats = {};
    
    docsSnapshot.forEach(doc => {
      const data = doc.data();
      const fields = extractFieldPaths(data);
      
      for (const [fieldPath, fieldInfo] of Object.entries(fields)) {
        if (!fieldStats[fieldPath]) {
          fieldStats[fieldPath] = {
            count: 0,
            types: new Set(),
            examples: new Set()
          };
        }
        
        fieldStats[fieldPath].count++;
        fieldStats[fieldPath].types.add(fieldInfo.type);
        
        // Collect up to 3 unique examples
        if (fieldStats[fieldPath].examples.size < 3 && fieldInfo.value !== null && fieldInfo.value !== undefined) {
          fieldStats[fieldPath].examples.add(JSON.stringify(fieldInfo.value));
        }
      }
    });
    
    // Convert to array format
    const fields = Object.entries(fieldStats).map(([name, stats]) => ({
      name,
      count: stats.count,
      coverage: (stats.count / sampleSize * 100).toFixed(1) + '%',
      types: Array.from(stats.types),
      examples: Array.from(stats.examples).slice(0, 3).map(ex => {
        try {
          return JSON.parse(ex);
        } catch {
          return ex;
        }
      })
    }));
    
    // Sort by coverage (most common fields first)
    fields.sort((a, b) => b.count - a.count);
    
    // Determine status
    let status = 'active';
    if (totalCount < 5) {
      status = 'few_docs';
    } else if (fields.length > 50) {
      status = 'possible_test_data';
    }
    
    // Show top fields in console
    console.log(`   📋 Top fields (${fields.length} total):`);
    fields.slice(0, 10).forEach(field => {
      console.log(`      - ${field.name}: ${field.coverage} coverage, types: ${field.types.join('|')}`);
    });
    
    return {
      name: collectionName,
      docCount: totalCount,
      sampledDocs: sampleSize,
      fields,
      status
    };
    
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return {
      name: collectionName,
      docCount: 0,
      sampledDocs: 0,
      fields: [],
      status: 'error',
      error: error.message
    };
  }
}

/**
 * Main audit function
 */
async function auditFirestore() {
  console.log('🔍 FIRESTORE USAGE AUDIT');
  console.log('═'.repeat(70));
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log(`Max sample size per collection: ${MAX_DOCS_TO_SAMPLE} documents\n`);
  
  // Get all collections
  console.log('📚 Discovering collections...\n');
  const collections = await db.listCollections();
  const collectionNames = collections.map(col => col.id).sort();
  
  console.log(`Found ${collectionNames.length} top-level collections:`);
  collectionNames.forEach(name => console.log(`   - ${name}`));
  
  // Analyze each collection
  const results = [];
  
  for (const collectionName of collectionNames) {
    const result = await analyzeCollection(collectionName);
    results.push(result);
  }
  
  // Generate report
  const report = {
    generatedAt: new Date().toISOString(),
    totalCollections: results.length,
    collections: results,
    summary: generateSummary(results)
  };
  
  // Save to JSON file
  const outputPath = join(process.cwd(), 'firestore-audit-report.json');
  writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf8');
  
  // Print summary
  printSummary(results, outputPath);
  
  return report;
}

/**
 * Generate summary statistics
 */
function generateSummary(results) {
  const summary = {
    empty: [],
    fewDocs: [],
    active: [],
    possibleTestData: [],
    errors: []
  };
  
  results.forEach(result => {
    switch (result.status) {
      case 'empty':
        summary.empty.push(result.name);
        break;
      case 'few_docs':
        summary.fewDocs.push({ name: result.name, count: result.docCount });
        break;
      case 'active':
        summary.active.push({ name: result.name, count: result.docCount });
        break;
      case 'possible_test_data':
        summary.possibleTestData.push({ name: result.name, count: result.docCount, fieldCount: result.fields.length });
        break;
      case 'error':
        summary.errors.push({ name: result.name, error: result.error });
        break;
    }
  });
  
  return summary;
}

/**
 * Print summary to console
 */
function printSummary(results, outputPath) {
  console.log('\n' + '═'.repeat(70));
  console.log('\n📊 AUDIT SUMMARY\n');
  
  const summary = generateSummary(results);
  
  // Active collections
  if (summary.active.length > 0) {
    console.log('✅ Active collections (looks good):');
    summary.active.forEach(c => {
      console.log(`   - ${c.name}: ${c.count} documents`);
    });
  }
  
  // Collections with few docs
  if (summary.fewDocs.length > 0) {
    console.log('\n⚠️  Collections with few documents:');
    summary.fewDocs.forEach(c => {
      console.log(`   - ${c.name}: ${c.count} documents`);
    });
  }
  
  // Possible test data
  if (summary.possibleTestData.length > 0) {
    console.log('\n🔍 Possible test/messy data (many fields):');
    summary.possibleTestData.forEach(c => {
      console.log(`   - ${c.name}: ${c.count} docs, ${c.fieldCount} unique fields`);
    });
  }
  
  // Empty collections
  if (summary.empty.length > 0) {
    console.log('\n📭 Empty collections:');
    summary.empty.forEach(name => {
      console.log(`   - ${name}`);
    });
  }
  
  // Errors
  if (summary.errors.length > 0) {
    console.log('\n❌ Errors:');
    summary.errors.forEach(e => {
      console.log(`   - ${e.name}: ${e.error}`);
    });
  }
  
  // Key insights
  console.log('\n💡 Key Insights:\n');
  
  const totalDocs = results.reduce((sum, r) => sum + r.docCount, 0);
  console.log(`   • Total documents across all collections: ${totalDocs}`);
  console.log(`   • Active collections: ${summary.active.length}`);
  console.log(`   • Empty collections: ${summary.empty.length}`);
  
  if (summary.possibleTestData.length > 0) {
    console.log(`   • Collections that may need cleanup: ${summary.possibleTestData.length}`);
  }
  
  // Common fields analysis
  console.log('\n🔑 Common identifier fields found:');
  const commonFields = ['companyId', 'locationId', 'userId', 'createdAt', 'updatedAt'];
  const fieldUsage = {};
  
  results.forEach(result => {
    result.fields.forEach(field => {
      commonFields.forEach(commonField => {
        if (field.name === commonField || field.name.endsWith(`.${commonField}`)) {
          if (!fieldUsage[commonField]) {
            fieldUsage[commonField] = [];
          }
          fieldUsage[commonField].push(result.name);
        }
      });
    });
  });
  
  Object.entries(fieldUsage).forEach(([field, collections]) => {
    console.log(`   • ${field}: used in ${collections.length} collections`);
  });
  
  console.log('\n' + '═'.repeat(70));
  console.log(`\n✅ Audit complete!`);
  console.log(`📄 Full report saved to: ${outputPath}\n`);
}

// Run the audit
auditFirestore()
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Audit failed:', error);
    process.exit(1);
  });
