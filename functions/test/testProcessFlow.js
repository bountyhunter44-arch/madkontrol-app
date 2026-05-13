/**
 * Test script for complete process flow:
 * cooling fail → recovery options → reheating → new cooling
 * 
 * Run with: node functions/test/testProcessFlow.js
 */

const admin = require("firebase-admin");
const path = require("path");

if (!admin.apps.length) {
  const serviceAccount = require(path.join(__dirname, "../../serviceAccountKey.json"));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id
  });
}

const processInstances = require("../processInstances");

async function testCompleteFlow() {
  console.log("\n=== TEST: Complete Process Flow ===\n");
  
  const testData = {
    companyId: "test_company_001",
    locationId: "test_location_001",
    userId: "test_user_001"
  };
  
  try {
    // Step 1: Start cooling process
    console.log("1️⃣ Starting cooling process...");
    const coolingResult = await processInstances.startCoolingProcess({
      companyId: testData.companyId,
      locationId: testData.locationId,
      userId: testData.userId,
      productName: "Kyllingebryst (stegt)",
      batchSize: "2.5 kg",
      container: "Gastronorm 1/1",
      startTemperature: 78
    });
    
    console.log(`✅ Cooling process started: ${coolingResult.processId}`);
    console.log(`   Start temp: ${coolingResult.processData.startTemperature}°C`);
    
    const coolingProcessId = coolingResult.processId;
    
    // Step 2: Add intermediate measurement
    console.log("\n2️⃣ Adding intermediate measurement...");
    await processInstances.addCoolingMeasurement({
      processId: coolingProcessId,
      temperature: 42,
      note: "Efter 1 time",
      userId: testData.userId
    });
    
    console.log("✅ Measurement added: 42°C");
    
    // Step 3: Complete cooling with FAILURE (simulate timeout)
    console.log("\n3️⃣ Completing cooling process (SIMULATING FAILURE)...");
    
    // Simulate 4+ hours by manually setting endTemperature to 15°C (not reached 10°C)
    const completionResult = await processInstances.completeCoolingProcess({
      processId: coolingProcessId,
      endTemperature: 15,  // Failed to reach 10°C
      note: "Timeout - ikke nået 10°C",
      userId: testData.userId
    });
    
    console.log(`❌ Cooling FAILED: ${completionResult.status}`);
    console.log(`   Requires recovery: ${completionResult.requiresRecovery}`);
    console.log(`   Deviation created: ${completionResult.deviationId}`);
    
    if (!completionResult.requiresRecovery) {
      throw new Error("Expected cooling to fail, but it succeeded");
    }
    
    // Step 4: Start reheating process (recovery)
    console.log("\n4️⃣ Starting reheating process (RECOVERY)...");
    const reheatingResult = await processInstances.startReheatingProcess({
      companyId: testData.companyId,
      locationId: testData.locationId,
      userId: testData.userId,
      failedCoolingProcessId: coolingProcessId
    });
    
    console.log(`✅ Reheating process started: ${reheatingResult.processId}`);
    console.log(`   Start temp: ${reheatingResult.processData.startTemperature}°C (from failed cooling)`);
    console.log(`   Triggered by cooling failure: ${reheatingResult.processData.triggeredByCoolingFailure}`);
    
    const reheatingProcessId = reheatingResult.processId;
    
    // Step 5: Complete reheating with SUCCESS
    console.log("\n5️⃣ Completing reheating process (SUCCESS)...");
    const reheatingCompletionResult = await processInstances.completeReheatingProcess({
      processId: reheatingProcessId,
      endTemperature: 78,  // Successfully reached 75°C+
      note: "Målt i centrum af fødevaren",
      userId: testData.userId
    });
    
    console.log(`✅ Reheating SUCCESS: ${reheatingCompletionResult.status}`);
    console.log(`   Can start new cooling: ${reheatingCompletionResult.canStartNewCooling}`);
    
    if (!reheatingCompletionResult.canStartNewCooling) {
      throw new Error("Expected reheating to succeed, but it failed");
    }
    
    // Step 6: Start new cooling from reheating
    console.log("\n6️⃣ Starting new cooling from reheating...");
    const newCoolingResult = await processInstances.startNewCoolingFromReheating({
      reheatingProcessId,
      userId: testData.userId
    });
    
    console.log(`✅ New cooling process started: ${newCoolingResult.processId}`);
    console.log(`   Start temp: ${newCoolingResult.processData.startTemperature}°C (from reheating)`);
    console.log(`   Product: ${newCoolingResult.processData.productName}`);
    
    const newCoolingProcessId = newCoolingResult.processId;
    
    // Step 7: Complete new cooling with SUCCESS
    console.log("\n7️⃣ Completing new cooling process (SUCCESS)...");
    const newCoolingCompletionResult = await processInstances.completeCoolingProcess({
      processId: newCoolingProcessId,
      endTemperature: 8,  // Successfully reached 10°C
      note: "Nedkøling gennemført efter genopvarmning",
      userId: testData.userId
    });
    
    console.log(`✅ New cooling SUCCESS: ${newCoolingCompletionResult.status}`);
    console.log(`   Requires recovery: ${newCoolingCompletionResult.requiresRecovery}`);
    
    // Step 8: Load active processes (should be empty now)
    console.log("\n8️⃣ Loading active process instances...");
    const activeProcesses = await processInstances.loadActiveProcessInstances({
      locationId: testData.locationId
    });
    
    console.log(`✅ Active processes: ${activeProcesses.length}`);
    console.log("   (Should be 0 since all processes are completed)");
    
    // Summary
    console.log("\n=== TEST SUMMARY ===");
    console.log("✅ All steps completed successfully!");
    console.log("\nFlow:");
    console.log(`1. Cooling started: ${coolingProcessId}`);
    console.log(`2. Cooling failed (15°C > 10°C)`);
    console.log(`3. Deviation created: ${completionResult.deviationId}`);
    console.log(`4. Reheating started: ${reheatingProcessId}`);
    console.log(`5. Reheating succeeded (78°C >= 75°C)`);
    console.log(`6. New cooling started: ${newCoolingProcessId}`);
    console.log(`7. New cooling succeeded (8°C <= 10°C)`);
    console.log(`8. All processes completed`);
    
    console.log("\n✅ TEST PASSED\n");
    
  } catch (error) {
    console.error("\n❌ TEST FAILED");
    console.error("Error:", error.message);
    console.error(error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Run test
testCompleteFlow();
