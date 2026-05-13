# Multi-Tenant Architecture Implementation Plan

## 🎯 Objective
Transform Madkontrollen into a professional multi-tenant SaaS platform with proper authentication, role-based access control, and module permissions.

## 📊 Current State Analysis

### Authentication (auth.js)
✅ **Already Implemented:**
- User authentication with Firebase Auth
- Role-based profile system (`role: "owner" | "admin" | "employee"`)
- Session persistence with `companyId` and `locationId`
- Location-based access control

❌ **Missing:**
- Employee creation interface for admins
- Module permission checks in navigation
- Strict enforcement of role-based UI visibility

### Security Rules (firestore.rules)
✅ **Already Implemented:**
- Multi-tenant isolation via `organizationId`/`companyId`
- Location-based access control
- Role-based permissions (owner, admin, employee)
- Proper read/write restrictions

❌ **Missing:**
- Rules for `inventory_*` collections
- Rules for `deviations` collection
- Rules for `reports` collection
- Module permission enforcement

### Database Schema
✅ **Partially Implemented:**
- Most collections have `organizationId`/`companyId`
- Most collections have `locationId`
- User roles exist

❌ **Missing:**
- Consistent naming (`companyId` vs `organizationId`)
- Module permissions on user documents
- Test data cleanup

## 🏗️ Implementation Strategy

### Phase 1: Database Standardization ✅
**Goal:** Ensure ALL collections use consistent `companyId` and `locationId`

**Actions:**
1. Update `core/database.js` to enforce schema (DONE)
2. Add missing collections to Firestore rules
3. Run migration script to add missing fields
4. Delete test data without proper `companyId`

### Phase 2: Module Permissions System
**Goal:** Control which modules users can access based on their subscription

**User Document Schema:**
```javascript
{
  userId: "user_123",
  email: "owner@restaurant.dk",
  displayName: "Restaurant Owner",
  role: "owner" | "admin" | "employee",
  companyId: "comp_abc",
  locationId: "loc_xyz",
  locationIds: ["loc_xyz", "loc_def"],
  
  // Module Permissions (NEW)
  modules: {
    core: true,              // Egenkontrol (always true)
    inventory: true,         // Lager & Stregkode
    institutional: false,    // Skoler & Institutioner
    accounting: true,        // Regnskab
    menu: true,              // Menu design
    pos: false,              // POS integration
    analytics: true          // Advanced analytics
  }
}
```

### Phase 3: Role-Based Navigation
**Goal:** Show/hide navigation items based on role and module permissions

**Admin (Owner) sees:**
- 💰 Profit-Balance Dashboard
- 📦 Modtagelse → 🍳 Produktion → 🍽️ Service → 🔒 Luk
- 📊 Regnskab
- 👥 Personale
- ⚙️ Indstillinger
- All purchased modules

**Employee (Kok) sees:**
- 📋 Rutiner (Daily tasks)
- 📦 Lager Scan (if inventory module enabled)
- 📷 Billedarkiv
- NO admin features
- NO profit dashboard
- NO accounting

### Phase 4: Employee Management Interface
**Goal:** Allow admins to create and manage employee accounts

**New Page:** `/admin/personale.html`

**Features:**
- Create employee with email/password
- Assign role (admin vs employee)
- Assign location access
- Enable/disable modules per employee
- View all employees in company
- Reset passwords
- Deactivate accounts

### Phase 5: File Structure Reorganization
**Goal:** Logical folder structure matching business logic

**New Structure:**
```
public/
├── core/                      # Authentication & shared logic
│   ├── auth.js               ✅ (exists)
│   ├── database.js           ✅ (created)
│   ├── workflow.js           ✅ (created)
│   └── firebase-config.js    ✅ (exists)
│
├── modules/
│   ├── 01-egenkontrol/       # Core HACCP module
│   │   ├── dashboard.html
│   │   ├── rutiner.html
│   │   ├── afvigelser/
│   │   ├── rapporter/
│   │   └── risikoanalyse/
│   │
│   ├── 02-lager/             # Inventory module
│   │   ├── scanner.html
│   │   ├── dashboard.html
│   │   └── profit-balance.html
│   │
│   ├── 03-institutional/     # Schools & institutions
│   │   └── skole/
│   │
│   └── 04-commercial/        # Restaurant features
│       ├── menu/
│       ├── kalkulation/
│       └── drift/
│
├── admin/                     # Admin-only pages
│   ├── personale.html        # Employee management (NEW)
│   ├── indstillinger.html    # Settings
│   ├── regnskab/             # Accounting
│   └── moduler.html          # Module management (NEW)
│
└── index.html                # Landing page
```

## 🔒 Security Rules Update

### Add Missing Collections

```javascript
// Deviations
match /deviations/{deviationId} {
  allow get: if canReadOrgLocation(orgIdFromData(resource.data), resource.data.locationId);
  allow list: if userExists() && isEmployee();
  allow create: if sameOrgAndLocation(orgIdFromData(request.resource.data), request.resource.data.locationId) && isEmployee();
  allow update: if sameOrgAndLocation(orgIdFromData(resource.data), resource.data.locationId) && isEmployee() && unchangedOrganization() && unchangedLocation();
  allow delete: if false;
}

// Reports
match /reports/{reportId} {
  allow get: if canReadOrgLocation(orgIdFromData(resource.data), resource.data.locationId);
  allow list: if userExists() && isEmployee();
  allow create: if sameOrgAndLocation(orgIdFromData(request.resource.data), request.resource.data.locationId) && isEmployee();
  allow update: if sameOrgAndLocation(orgIdFromData(resource.data), resource.data.locationId) && isAdmin() && unchangedOrganization() && unchangedLocation();
  allow delete: if false;
}

// Inventory Items
match /inventory_items/{itemId} {
  allow get: if canReadOrgLocation(orgIdFromData(resource.data), resource.data.locationId);
  allow list: if userExists() && isEmployee() && userDoc().data.modules.inventory == true;
  allow create: if sameOrgAndLocation(orgIdFromData(request.resource.data), request.resource.data.locationId) && isEmployee() && userDoc().data.modules.inventory == true;
  allow update: if sameOrgAndLocation(orgIdFromData(resource.data), resource.data.locationId) && isEmployee() && userDoc().data.modules.inventory == true && unchangedOrganization() && unchangedLocation();
  allow delete: if false;
}

// Inventory Transactions
match /inventory_transactions/{transactionId} {
  allow get: if canReadOrgLocation(orgIdFromData(resource.data), resource.data.locationId);
  allow list: if userExists() && isEmployee() && userDoc().data.modules.inventory == true;
  allow create: if sameOrgAndLocation(orgIdFromData(request.resource.data), request.resource.data.locationId) && isEmployee() && userDoc().data.modules.inventory == true;
  allow update: if false;
  allow delete: if false;
}

// Inventory Alerts
match /inventory_alerts/{alertId} {
  allow get: if canReadOrgLocation(orgIdFromData(resource.data), resource.data.locationId);
  allow list: if userExists() && isEmployee() && userDoc().data.modules.inventory == true;
  allow create: if sameOrgAndLocation(orgIdFromData(request.resource.data), request.resource.data.locationId) && isEmployee() && userDoc().data.modules.inventory == true;
  allow update: if sameOrgAndLocation(orgIdFromData(resource.data), resource.data.locationId) && isEmployee() && userDoc().data.modules.inventory == true && unchangedOrganization() && unchangedLocation();
  allow delete: if false;
}
```

## 🧹 Database Cleanup Script

```javascript
// Run this in Firebase Console or Cloud Functions
async function cleanupDatabase() {
  const collections = [
    'task_instances',
    'daily_runs',
    'deviations',
    'reports',
    'inventory_items',
    'inventory_transactions',
    'inventory_alerts',
    'media_assets'
  ];
  
  for (const collectionName of collections) {
    const snapshot = await db.collection(collectionName).get();
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      
      // Delete if missing companyId/organizationId
      if (!data.companyId && !data.organizationId) {
        console.log(`Deleting ${collectionName}/${doc.id} - missing companyId`);
        await doc.ref.delete();
        continue;
      }
      
      // Delete test data
      if (doc.id.startsWith('test_') || doc.id.startsWith('demo_') || doc.id.startsWith('temp_')) {
        console.log(`Deleting ${collectionName}/${doc.id} - test data`);
        await doc.ref.delete();
        continue;
      }
    }
  }
  
  console.log('✅ Database cleanup complete');
}
```

## 📋 Implementation Checklist

### Database & Security
- [x] Create unified database schema (database.js)
- [ ] Add missing collections to firestore.rules
- [ ] Add module permission checks to security rules
- [ ] Run database cleanup script
- [ ] Migrate inconsistent field names (organizationId → companyId)

### Authentication & Roles
- [x] Role-based auth system exists (auth.js)
- [ ] Add module permissions to user schema
- [ ] Create employee management interface
- [ ] Implement role-based navigation hiding

### Navigation & UI
- [ ] Create dynamic navigation component
- [ ] Hide modules based on permissions
- [ ] Show different nav for admin vs employee
- [ ] Add profit slider only for admins

### File Structure
- [ ] Create new folder structure
- [ ] Move files to appropriate folders
- [ ] Update all internal links
- [ ] Test all navigation paths

## 🚀 Deployment Order

1. **Update Firestore Rules** (no breaking changes)
2. **Deploy database.js helpers** (new functionality)
3. **Run cleanup script** (remove bad data)
4. **Update user documents** (add module permissions)
5. **Deploy employee management page**
6. **Update navigation components**
7. **Reorganize files** (last, requires link updates)

## ✅ Success Criteria

After implementation:
- ✅ All collections have `companyId` and `locationId`
- ✅ Users can only see data from their company
- ✅ Admins can create employees
- ✅ Employees see limited navigation
- ✅ Module permissions control feature access
- ✅ No test data in production
- ✅ Clean, logical file structure
- ✅ All links work correctly
