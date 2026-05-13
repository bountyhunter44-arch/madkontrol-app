// Simple script to demonstrate the approach
// User should run this via Firebase Functions Shell or create a simple frontend trigger

console.log(`
📋 MANUAL STEPS TO REGENERATE TASKS:

1. Open Firebase Console: https://console.firebase.google.com/project/madkontrollen/firestore

2. Navigate to 'task_instances' collection

3. Filter by:
   - locationId == "onboarding_aroi-d__main"
   - dateKey == "2026-03-29"

4. Delete all matching documents (use batch delete if available)

5. Open your app at: https://madkontrollen.web.app/modules/egenkontrol/rutiner.html

6. Open browser console and run:
   await window.testGenerateTasks()

7. Or use Firebase Functions Shell:
   firebase functions:shell
   > generateTaskInstancesNow({ dateKey: "2026-03-29", locationId: "onboarding_aroi-d__main" })

ALTERNATIVE - Use deployed function:
Call the deployed generateTaskInstancesNow function via your frontend or Postman.

Expected result:
- New task_instances created with Danish titles from controlLibrary
- Unit-based tasks for fridges/freezers (if units exist)
- Template-based tasks from task_templates

Check titles in Firestore after generation to verify Danish formulations.
`);
