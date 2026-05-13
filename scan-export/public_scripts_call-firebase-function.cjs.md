# FILE: public/scripts/call-firebase-function.cjs

```javascript
/**
 * Call Firebase Cloud Function to trigger task_instance regeneration
 */

const https = require('https');

const FUNCTION_URL = 'https://generatetaskinstancesnow-xzqhxqpfja-ew.a.run.app';

function callFunction() {
    console.log('\n=== CALLING FIREBASE FUNCTION: generateTaskInstancesNow ===\n');
    
    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    };
    
    const req = https.request(FUNCTION_URL, options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
            data += chunk;
        });
        
        res.on('end', () => {
            console.log(`Status Code: ${res.statusCode}\n`);
            
            if (res.statusCode === 200) {
                console.log('✅ Function executed successfully\n');
                console.log('Response:', data);
            } else {
                console.log('⚠️ Function returned non-200 status\n');
                console.log('Response:', data);
            }
            
            console.log('\n=== WAITING 5 SECONDS FOR TASK_INSTANCES TO BE WRITTEN ===\n');
            
            setTimeout(() => {
                console.log('✅ Ready to fetch task_instances\n');
                process.exit(0);
            }, 5000);
        });
    });
    
    req.on('error', (error) => {
        console.error('❌ Error calling function:', error.message);
        process.exit(1);
    });
    
    req.write(JSON.stringify({}));
    req.end();
}

callFunction();

```
