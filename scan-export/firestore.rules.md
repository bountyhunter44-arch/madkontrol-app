# FILE: firestore.rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function signedIn() {
      return request.auth != null;
    }

    function userPath() {
      return /databases/$(database)/documents/users/$(request.auth.uid);
    }

    function userExists() {
      return signedIn() && exists(userPath());
    }

    function userDoc() {
      return get(userPath());
    }

    function userOrgId() {
      return userDoc().data.organizationId != null
        ? userDoc().data.organizationId
        : userDoc().data.companyId;
    }

    function userRole() {
      return userDoc().data.role;
    }

    function userLocationIds() {
      return userDoc().data.locationIds is list
        ? userDoc().data.locationIds
        : userDoc().data.primaryLocationId != null
          ? [userDoc().data.primaryLocationId]
          : userDoc().data.locationId != null
            ? [userDoc().data.locationId]
            : [];
    }

    function orgIdFromData(data) {
      return data.organizationId != null
        ? data.organizationId
        : data.companyId;
    }

    function sameOrganization(orgId) {
      return userExists() && userOrgId() == orgId;
    }

    function hasLocationAccess(locationId) {
      return userExists() && (
        userRole() in ['owner', 'hq_admin', 'location_manager', 'admin'] ||
        locationId in userLocationIds()
      );
    }

    function sameOrgAndLocation(orgId, locationId) {
      return sameOrganization(orgId) && hasLocationAccess(locationId);
    }

    function isAdmin() {
      return userExists() &&
        userRole() in ['owner', 'hq_admin', 'location_manager', 'admin'];
    }

    function isOrgAdmin(orgId) {
      return sameOrganization(orgId) && isAdmin();
    }

    function isEmployee() {
      return userExists() &&
        userRole() in ['owner', 'hq_admin', 'location_manager', 'admin', 'manager', 'employee'];
    }

    function isSuperAdmin() {
      return signedIn() && 
        userRole() == 'super-admin' &&
        request.auth.token.email in [
          'mn@aroid.dk'  // Replace with actual super-admin email
        ];
    }

    function isInspectorView() {
      return userExists() && userRole() == 'inspector_view';
    }

    function canReadOrgLocation(orgId, locationId) {
      return sameOrgAndLocation(orgId, locationId) ||
        (sameOrganization(orgId) && isInspectorView() && hasLocationAccess(locationId));
    }

    function unchangedOrganization() {
      return orgIdFromData(request.resource.data) == orgIdFromData(resource.data);
    }

    function unchangedLocation() {
      return request.resource.data.locationId == resource.data.locationId;
    }

    function validUserCreate(userId) {
      return signedIn() && request.auth.uid == userId;
    }

    match /users/{userId} {
      allow read: if signedIn() && (
        request.auth.uid == userId ||
        (userExists() && sameOrganization(orgIdFromData(resource.data)) && isAdmin()) ||
        isSuperAdmin()
      );

      allow create: if validUserCreate(userId);
      allow update: if signedIn() && (
        request.auth.uid == userId ||
        (userExists() && sameOrganization(orgIdFromData(resource.data)) && isAdmin())
      );
      allow delete: if false;
    }

    match /organizations/{orgId} {
      allow read: if sameOrganization(orgId) || isSuperAdmin();
      allow create: if signedIn();
      allow update: if isOrgAdmin(orgId);
      allow delete: if false;
    }

    match /companies/{companyId} {
      allow read: if sameOrganization(companyId) || isSuperAdmin();
      allow create: if signedIn();
      allow update: if isOrgAdmin(companyId);
      allow delete: if false;
    }

    match /locations/{locationId} {
      allow read: if canReadOrgLocation(orgIdFromData(resource.data), locationId) || isSuperAdmin();
      allow create: if isOrgAdmin(orgIdFromData(request.resource.data));
      allow update: if isOrgAdmin(orgIdFromData(resource.data));
      allow delete: if false;
    }

    match /task_templates/{templateId} {
      allow read: if true;
      allow create: if true;
      allow update: if true;
      allow delete: if false;
    }

    match /tasks/{taskId} {
      allow read: if true;
      allow create: if true;
      allow update: if true;
      allow delete: if false;
    }

    match /task_instances/{instanceId} {
      allow get: if canReadOrgLocation(orgIdFromData(resource.data), resource.data.locationId) || isSuperAdmin();
      allow list: if (userExists() && isEmployee()) || isSuperAdmin();
      allow create: if (sameOrgAndLocation(orgIdFromData(request.resource.data), request.resource.data.locationId) && isEmployee()) || isSuperAdmin();
      allow update: if (sameOrgAndLocation(orgIdFromData(resource.data), resource.data.locationId) && isEmployee() && unchangedOrganization() && unchangedLocation()) || isSuperAdmin();
      allow delete: if false;
    }

    match /task_entries/{entryId} {
      allow get: if canReadOrgLocation(orgIdFromData(resource.data), resource.data.locationId) || isSuperAdmin();
      allow list: if (userExists() && isEmployee()) || isSuperAdmin();
      allow create: if (sameOrgAndLocation(orgIdFromData(request.resource.data), request.resource.data.locationId) && isEmployee()) || isSuperAdmin();
      allow update: if isSuperAdmin();
      allow delete: if false;
    }

    match /daily_runs/{runId} {
      allow get: if canReadOrgLocation(orgIdFromData(resource.data), resource.data.locationId) || isSuperAdmin();
      allow list: if (userExists() && isEmployee()) || isSuperAdmin();
      allow create: if (sameOrgAndLocation(orgIdFromData(request.resource.data), request.resource.data.locationId) && isEmployee()) || isSuperAdmin();
      allow update: if (sameOrgAndLocation(orgIdFromData(resource.data), resource.data.locationId) && isEmployee() && unchangedOrganization() && unchangedLocation()) || isSuperAdmin();
      allow delete: if false;
    }

    match /logbook_entries/{entryId} {
      allow read: if canReadOrgLocation(orgIdFromData(resource.data), resource.data.locationId) || isSuperAdmin();
      allow create: if (sameOrgAndLocation(orgIdFromData(request.resource.data), request.resource.data.locationId) && isEmployee()) || isSuperAdmin();
      allow update: if (sameOrgAndLocation(orgIdFromData(resource.data), resource.data.locationId) && isEmployee() && unchangedOrganization() && unchangedLocation()) || isSuperAdmin();
      allow delete: if false;
    }

    match /operating_overrides/{docId} {
      allow read: if canReadOrgLocation(orgIdFromData(resource.data), resource.data.locationId) || isSuperAdmin();
      allow create: if (sameOrgAndLocation(orgIdFromData(request.resource.data), request.resource.data.locationId) && isAdmin()) || isSuperAdmin();
      allow update: if (sameOrgAndLocation(orgIdFromData(resource.data), resource.data.locationId) && isAdmin() && unchangedOrganization() && unchangedLocation()) || isSuperAdmin();
      allow delete: if false;
    }

    match /service_sessions/{sessionId} {
      allow read: if canReadOrgLocation(orgIdFromData(resource.data), resource.data.locationId);
      allow create: if sameOrgAndLocation(orgIdFromData(request.resource.data), request.resource.data.locationId) && isEmployee();
      allow update: if sameOrgAndLocation(orgIdFromData(resource.data), resource.data.locationId) && isEmployee() && unchangedOrganization() && unchangedLocation();
      allow delete: if false;
    }

    match /equipment/{equipmentId} {
      allow get: if canReadOrgLocation(orgIdFromData(resource.data), resource.data.locationId);
      allow list: if userExists() && isEmployee();
      allow create: if isOrgAdmin(orgIdFromData(request.resource.data)) && hasLocationAccess(request.resource.data.locationId);
      allow update: if isOrgAdmin(orgIdFromData(resource.data)) && hasLocationAccess(resource.data.locationId) && unchangedOrganization() && unchangedLocation();
      allow delete: if false;
    }

    match /documents/{documentId} {
      allow read: if canReadOrgLocation(orgIdFromData(resource.data), resource.data.locationId);
      allow create: if sameOrgAndLocation(orgIdFromData(request.resource.data), request.resource.data.locationId) && isAdmin();
      allow update: if sameOrgAndLocation(orgIdFromData(resource.data), resource.data.locationId) && isAdmin() && unchangedOrganization() && unchangedLocation();
      allow delete: if false;
    }

    match /alerts/{alertId} {
      allow get: if canReadOrgLocation(orgIdFromData(resource.data), resource.data.locationId) || isSuperAdmin();
      allow list: if (userExists() && isEmployee()) || isSuperAdmin();
      allow create: if (sameOrgAndLocation(orgIdFromData(request.resource.data), request.resource.data.locationId) && isEmployee()) || isSuperAdmin();
      allow update: if sameOrgAndLocation(orgIdFromData(resource.data), resource.data.locationId) && isEmployee() && unchangedOrganization() && unchangedLocation();
      allow delete: if false;
    }

    match /media_assets/{assetId} {
      allow get: if signedIn() &&
        request.auth.uid == resource.data.userId &&
        sameOrgAndLocation(orgIdFromData(resource.data), resource.data.locationId);

      allow list: if signedIn();

      allow create: if signedIn() &&
        request.auth.uid == request.resource.data.userId &&
        sameOrgAndLocation(orgIdFromData(request.resource.data), request.resource.data.locationId) &&
        isEmployee();

      allow update: if signedIn() &&
        request.auth.uid == resource.data.userId &&
        request.auth.uid == request.resource.data.userId &&
        sameOrgAndLocation(orgIdFromData(resource.data), resource.data.locationId) &&
        unchangedOrganization() &&
        unchangedLocation();

      allow delete: if false;
    }

    match /haccp_snapshots/{snapshotId} {
      allow get: if (userExists() && isEmployee() && sameOrganization(orgIdFromData(resource.data))) || isSuperAdmin();
      allow list: if (userExists() && isEmployee()) || isSuperAdmin();
      allow create: if (sameOrganization(orgIdFromData(request.resource.data)) && isEmployee()) || isSuperAdmin();
      allow update: if sameOrganization(orgIdFromData(resource.data)) && isEmployee() && unchangedOrganization();
      allow delete: if false;
    }

    match /live_user_profiles/{profileId} {
      allow get: if sameOrganization(orgIdFromData(resource.data)) || isSuperAdmin();
      allow list: if (userExists() && isEmployee()) || isSuperAdmin();
      allow create: if (sameOrganization(orgIdFromData(request.resource.data)) && isEmployee()) || isSuperAdmin();
      allow update: if sameOrganization(orgIdFromData(resource.data)) && isEmployee() && unchangedOrganization();
      allow delete: if false;
    }

    match /areas/{areaId} {
      allow get: if canReadOrgLocation(orgIdFromData(resource.data), resource.data.locationId);
      allow list: if userExists() && isEmployee();
      allow create: if isOrgAdmin(orgIdFromData(request.resource.data)) && hasLocationAccess(request.resource.data.locationId);
      allow update: if isOrgAdmin(orgIdFromData(resource.data)) && hasLocationAccess(resource.data.locationId) && unchangedOrganization() && unchangedLocation();
      allow delete: if false;
    }

    match /deviations/{deviationId} {
      allow get: if canReadOrgLocation(orgIdFromData(resource.data), resource.data.locationId) || isSuperAdmin();
      allow list: if (userExists() && isEmployee()) || isSuperAdmin();
      allow create: if sameOrgAndLocation(orgIdFromData(request.resource.data), request.resource.data.locationId) && isEmployee();
      allow update: if sameOrgAndLocation(orgIdFromData(resource.data), resource.data.locationId) && isEmployee() && unchangedOrganization() && unchangedLocation();
      allow delete: if false;
    }

    match /reports/{reportId} {
      allow get: if canReadOrgLocation(orgIdFromData(resource.data), resource.data.locationId) || isSuperAdmin();
      allow list: if (userExists() && isEmployee()) || isSuperAdmin();
      allow create: if (sameOrgAndLocation(orgIdFromData(request.resource.data), request.resource.data.locationId) && isEmployee()) || isSuperAdmin();
      allow update: if sameOrgAndLocation(orgIdFromData(resource.data), resource.data.locationId) && isAdmin() && unchangedOrganization() && unchangedLocation();
      allow delete: if false;
    }

    match /inventory_items/{itemId} {
      allow get: if canReadOrgLocation(orgIdFromData(resource.data), resource.data.locationId);
      allow list: if userExists() && isEmployee();
      allow create: if sameOrgAndLocation(orgIdFromData(request.resource.data), request.resource.data.locationId) && isEmployee();
      allow update: if sameOrgAndLocation(orgIdFromData(resource.data), resource.data.locationId) && isEmployee() && unchangedOrganization() && unchangedLocation();
      allow delete: if false;
    }

    match /inventory_transactions/{transactionId} {
      allow get: if canReadOrgLocation(orgIdFromData(resource.data), resource.data.locationId);
      allow list: if userExists() && isEmployee();
      allow create: if sameOrgAndLocation(orgIdFromData(request.resource.data), request.resource.data.locationId) && isEmployee();
      allow update: if false;
      allow delete: if false;
    }

    match /inventory_alerts/{alertId} {
      allow get: if canReadOrgLocation(orgIdFromData(resource.data), resource.data.locationId);
      allow list: if userExists() && isEmployee();
      allow create: if sameOrgAndLocation(orgIdFromData(request.resource.data), request.resource.data.locationId) && isEmployee();
      allow update: if sameOrgAndLocation(orgIdFromData(resource.data), resource.data.locationId) && isEmployee() && unchangedOrganization() && unchangedLocation();
      allow delete: if false;
    }

    match /system_state/{stateId} {
      allow read: if userExists();
      allow write: if isAdmin();
    }

    match /workflow_state/{stateId} {
      allow read: if userExists();
      allow write: if isEmployee();
    }
  }
}

```
