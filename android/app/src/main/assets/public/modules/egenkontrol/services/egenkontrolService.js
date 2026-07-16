/**
 * Egenkontrol Service - Thin persistence layer
 * Handles reading snapshots and saving egenkontrol programs to Firestore
 */

import { buildEgenkontrolProgram, validateProgram } from '../generators/buildEgenkontrolProgram.js';

export async function generateAndSaveEgenkontrolProgram(db, companyId, locationId) {
    if (!db || !companyId || !locationId) {
        throw new Error('Missing required parameters: db, companyId, locationId');
    }
    
    const snapshotId = `${companyId}__${locationId}`;
    
    // Read HACCP snapshot
    const snapshotDoc = await db.collection('haccp_snapshots').doc(snapshotId).get();
    
    if (!snapshotDoc.exists) {
        throw new Error(`HACCP snapshot not found: ${snapshotId}`);
    }
    
    const snapshot = snapshotDoc.data();
    
    // Generate egenkontrol program
    const program = buildEgenkontrolProgram(snapshot);
    
    // Validate
    const validation = validateProgram(program);
    if (!validation.valid) {
        console.error('Program validation failed:', validation.errors);
        throw new Error(`Program validation failed: ${validation.errors.join(', ')}`);
    }
    
    // Prepare Firestore document
    const programId = snapshotId;
    const programRef = db.collection('egenkontrol_programs').doc(programId);
    
    // Check if document exists
    const existingDoc = await programRef.get();
    const now = new Date().toISOString();
    
    const firestoreDoc = {
        ...program,
        companyId: companyId,
        locationId: locationId,
        updatedAt: now
    };
    
    // Only set createdAt on first creation
    if (!existingDoc.exists) {
        firestoreDoc.createdAt = now;
    }
    
    // Save to Firestore
    await programRef.set(firestoreDoc, { merge: true });
    
    console.log(`✅ Egenkontrol program saved: ${programId}`);
    
    return {
        programId: programId,
        program: program,
        validation: validation
    };
}

export async function getEgenkontrolProgram(db, companyId, locationId) {
    if (!db || !companyId || !locationId) {
        throw new Error('Missing required parameters: db, companyId, locationId');
    }
    
    const programId = `${companyId}__${locationId}`;
    const programDoc = await db.collection('egenkontrol_programs').doc(programId).get();
    
    if (!programDoc.exists) {
        return null;
    }
    
    return programDoc.data();
}

export async function regenerateEgenkontrolProgram(db, companyId, locationId) {
    console.log(`🔄 Regenerating egenkontrol program for ${companyId}__${locationId}`);
    return await generateAndSaveEgenkontrolProgram(db, companyId, locationId);
}
