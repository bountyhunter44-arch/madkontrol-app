# Intelligent Lager & Stregkode Modul - Design Dokument

## Database Struktur

### 1. User Profile Extension
```javascript
// users/{userId}
{
  // Existing fields...
  hasInventoryModule: boolean,  // Feature flag for paid module
  inventoryModuleActivatedAt: Timestamp,
  inventoryModuleExpiresAt: Timestamp,
  inventorySettings: {
    enableFifoWarnings: true,
    expiryWarningDays: 3,  // Yellow warning 3 days before expiry
    criticalWarningDays: 1  // Red warning 1 day before expiry
  }
}
```

### 2. Inventory Items Collection
```javascript
// inventory_items/{itemId}
{
  itemId: "item_abc123",
  companyId: "comp_xyz",
  locationId: "loc_123",
  
  // Product info
  barcode: "5701234567890",  // EAN/UPC code
  productName: "Mælk 3.5%",
  productCategory: "dairy",  // dairy, meat, fish, vegetables, dry_goods, etc.
  supplier: "Arla",
  
  // Current stock
  currentQuantity: 12,
  unit: "stk",  // stk, kg, liter, etc.
  
  // Batches (FIFO tracking)
  batches: [
    {
      batchId: "batch_001",
      quantity: 5,
      expiryDate: "2026-03-25",
      receivedDate: "2026-03-20T08:30:00Z",
      receivedBy: "user_abc",
      deliveryTemperature: 4.2,
      deliveryTemperatureOk: true,
      scannedInAt: Timestamp
    },
    {
      batchId: "batch_002",
      quantity: 7,
      expiryDate: "2026-03-28",
      receivedDate: "2026-03-22T09:15:00Z",
      receivedBy: "user_xyz",
      deliveryTemperature: 3.8,
      deliveryTemperatureOk: true,
      scannedInAt: Timestamp
    }
  ],
  
  // Metadata
  createdAt: Timestamp,
  updatedAt: Timestamp,
  lastScannedAt: Timestamp
}
```

### 3. Inventory Transactions Collection
```javascript
// inventory_transactions/{transactionId}
{
  transactionId: "trans_abc123",
  companyId: "comp_xyz",
  locationId: "loc_123",
  
  // Transaction details
  type: "scan_in" | "scan_out" | "adjustment" | "waste",
  itemId: "item_abc123",
  barcode: "5701234567890",
  productName: "Mælk 3.5%",
  
  // Quantity
  quantity: 5,
  unit: "stk",
  
  // Batch info (for scan_in)
  batchId: "batch_001",
  expiryDate: "2026-03-25",
  deliveryTemperature: 4.2,
  deliveryTemperatureOk: true,
  
  // FIFO warning (for scan_out)
  fifoWarningTriggered: false,
  olderBatchAvailable: null,  // batchId of older batch if warning triggered
  
  // User & timestamp
  performedBy: "user_abc",
  performedByName: "John Doe",
  performedAt: Timestamp,
  
  // Integration with egenkontrol
  linkedToReport: "report_2026-03-22",
  temperatureCheckRecorded: true,
  
  // Notes
  note: "Levering fra Arla, temperatur kontrolleret"
}
```

### 4. Inventory Alerts Collection
```javascript
// inventory_alerts/{alertId}
{
  alertId: "alert_abc123",
  companyId: "comp_xyz",
  locationId: "loc_123",
  
  // Alert type
  type: "expiry_warning" | "expiry_critical" | "fifo_violation" | "out_of_stock",
  severity: "low" | "medium" | "high" | "critical",
  
  // Item details
  itemId: "item_abc123",
  barcode: "5701234567890",
  productName: "Mælk 3.5%",
  batchId: "batch_001",
  
  // Expiry info
  expiryDate: "2026-03-25",
  daysUntilExpiry: 3,
  quantity: 5,
  
  // Status
  status: "active" | "acknowledged" | "resolved",
  acknowledgedBy: "user_abc",
  acknowledgedAt: Timestamp,
  
  // Timestamps
  createdAt: Timestamp,
  resolvedAt: Timestamp
}
```

## Feature Flag Implementation

### Access Control Logic
```javascript
// Check if user has inventory module access
function hasInventoryAccess(userProfile) {
  if (!userProfile.hasInventoryModule) {
    return false;
  }
  
  // Check if module has expired
  if (userProfile.inventoryModuleExpiresAt) {
    const now = new Date();
    const expiryDate = userProfile.inventoryModuleExpiresAt.toDate();
    if (now > expiryDate) {
      return false;
    }
  }
  
  return true;
}

// UI rendering
if (hasInventoryAccess(userProfile)) {
  // Show full inventory module
  showInventoryScanner();
  showInventoryDashboard();
} else {
  // Show upgrade prompt
  showUpgradePrompt("Intelligent Lager & Stregkode");
}
```

## Mobile Scanner Interface

### Barcode Scanner Flow

**Scan In:**
```
1. User clicks "Scan ind" button
2. Camera opens with barcode scanner overlay
3. User scans EAN/barcode
4. System looks up product (or prompts for new product info)
5. User enters:
   - Quantity
   - Expiry date (date picker)
   - Delivery temperature (with "Er temperaturen ok?" checkbox)
6. System creates:
   - New batch in inventory_items
   - Transaction record
   - Temperature check linked to egenkontrol report
7. Confirmation shown with FIFO position
```

**Scan Out:**
```
1. User clicks "Scan ud" button
2. Camera opens with barcode scanner overlay
3. User scans EAN/barcode
4. System checks FIFO:
   - If oldest batch selected: ✅ Proceed
   - If newer batch exists: ⚠️ Warning shown
5. User enters quantity to take out
6. System:
   - Deducts from correct batch
   - Creates transaction record
   - Updates inventory_items
7. Confirmation shown
```

## FIFO Logic

### Algorithm
```javascript
function checkFifoViolation(itemId, requestedBatchId) {
  const item = await getInventoryItem(itemId);
  const batches = item.batches.sort((a, b) => 
    new Date(a.expiryDate) - new Date(b.expiryDate)
  );
  
  const oldestBatch = batches[0];
  
  if (oldestBatch.batchId !== requestedBatchId && oldestBatch.quantity > 0) {
    return {
      violation: true,
      message: `Hov! Brug den ældste vare først for at undgå spild.`,
      oldestBatch: {
        batchId: oldestBatch.batchId,
        expiryDate: oldestBatch.expiryDate,
        quantity: oldestBatch.quantity,
        daysUntilExpiry: calculateDaysUntilExpiry(oldestBatch.expiryDate)
      }
    };
  }
  
  return { violation: false };
}
```

## Expiry Alert Dashboard

### Widget Display
```
┌─────────────────────────────────────────────┐
│ 🚨 Varer der nærmer sig udløb              │
├─────────────────────────────────────────────┤
│ 🔴 Kritisk (1 dag)                          │
│   • Mælk 3.5% - Udløber i morgen (5 stk)   │
│   • Kyllingebryst - Udløber i morgen (2 kg)│
├─────────────────────────────────────────────┤
│ 🟡 Advarsel (2-3 dage)                      │
│   • Agurker - Udløber om 2 dage (8 stk)    │
│   • Fløde 38% - Udløber om 3 dage (3 L)    │
└─────────────────────────────────────────────┘
```

## Integration with Egenkontrol

### Temperature Check Flow
```javascript
// When scanning in item
async function scanInItem(barcode, quantity, expiryDate) {
  // 1. Show temperature check dialog
  const tempCheck = await showTemperatureCheckDialog();
  
  // 2. Create inventory transaction
  const transaction = await createInventoryTransaction({
    type: "scan_in",
    barcode,
    quantity,
    expiryDate,
    deliveryTemperature: tempCheck.temperature,
    deliveryTemperatureOk: tempCheck.isOk
  });
  
  // 3. Link to today's egenkontrol report
  const todayReport = await getTodaysReport();
  await addTemperatureCheckToReport(todayReport.reportId, {
    type: "delivery_check",
    productName: transaction.productName,
    temperature: tempCheck.temperature,
    isOk: tempCheck.isOk,
    timestamp: new Date(),
    performedBy: currentUser.uid
  });
  
  return transaction;
}
```

## API Endpoints

### Cloud Functions

**scanInventoryItem**
```javascript
exports.scanInventoryItem = functions.https.onCall(async (data, context) => {
  // Validate user has inventory module access
  // Process scan in/out
  // Update inventory_items
  // Create transaction record
  // Check FIFO if scan out
  // Create alerts if needed
  // Link to egenkontrol report if temperature check
});
```

**getInventoryAlerts**
```javascript
exports.getInventoryAlerts = functions.https.onCall(async (data, context) => {
  // Get all active alerts for location
  // Sort by severity and expiry date
  // Return formatted alert list
});
```

**checkFifoCompliance**
```javascript
exports.checkFifoCompliance = functions.https.onCall(async (data, context) => {
  // Check if requested batch violates FIFO
  // Return warning if violation detected
});
```

## Security Rules

```javascript
// Firestore rules for inventory collections
match /inventory_items/{itemId} {
  allow read: if request.auth != null 
    && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.hasInventoryModule == true
    && resource.data.companyId == get(/databases/$(database)/documents/users/$(request.auth.uid)).data.companyId;
    
  allow write: if request.auth != null
    && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.hasInventoryModule == true
    && request.resource.data.companyId == get(/databases/$(database)/documents/users/$(request.auth.uid)).data.companyId;
}

match /inventory_transactions/{transactionId} {
  allow read: if request.auth != null
    && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.hasInventoryModule == true
    && resource.data.companyId == get(/databases/$(database)/documents/users/$(request.auth.uid)).data.companyId;
    
  allow create: if request.auth != null
    && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.hasInventoryModule == true
    && request.resource.data.companyId == get(/databases/$(database)/documents/users/$(request.auth.uid)).data.companyId;
}

match /inventory_alerts/{alertId} {
  allow read: if request.auth != null
    && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.hasInventoryModule == true
    && resource.data.companyId == get(/databases/$(database)/documents/users/$(request.auth.uid)).data.companyId;
    
  allow update: if request.auth != null
    && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.hasInventoryModule == true
    && resource.data.companyId == get(/databases/$(database)/documents/users/$(request.auth.uid)).data.companyId;
}
```

## UI Components

### 1. Scanner Button (Locked State)
```html
<button class="inventory-scan-btn locked" onclick="showUpgradeModal()">
  🔒 Scan ind (Opgrader her)
</button>
```

### 2. Scanner Interface (Mobile)
```html
<div class="scanner-overlay">
  <div class="scanner-frame">
    <video id="scanner-video" autoplay></video>
    <div class="scanner-crosshair"></div>
  </div>
  <div class="scanner-instructions">
    Placer stregkoden i rammen
  </div>
</div>
```

### 3. FIFO Warning Modal
```html
<div class="fifo-warning-modal">
  <h3>⚠️ FIFO Advarsel</h3>
  <p>Hov! Brug den ældste vare først for at undgå spild.</p>
  <div class="batch-comparison">
    <div class="older-batch">
      <strong>Ældre vare:</strong>
      <div>Udløber: 25. mar 2026 (om 3 dage)</div>
      <div>Mængde: 5 stk</div>
    </div>
    <div class="newer-batch">
      <strong>Du valgte:</strong>
      <div>Udløber: 28. mar 2026 (om 6 dage)</div>
    </div>
  </div>
  <button class="btn btn-primary">Brug ældste vare</button>
  <button class="btn btn-secondary">Fortsæt alligevel</button>
</div>
```
