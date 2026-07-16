const path = require("path");
const admin = require("firebase-admin");
const { OWNER_LABEL, isValidOwnerKind } = require("../lib/ownerScope");

const SERVICE_ACCOUNT_PATH = path.join(__dirname, "../../serviceAccountKey.json");
const serviceAccount = require(SERVICE_ACCOUNT_PATH);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id
});

const db = admin.firestore();

const ROOT_COLLECTIONS = [
  { name: "companies", groupBy: (doc) => ({ companyId: doc.id, locationId: "" }) },
  { name: "locations", groupBy: (doc, data) => ({ companyId: data.companyId || data.organizationId || "", locationId: data.locationId || doc.id }) },
  { name: "users", groupBy: (_doc, data) => ({ companyId: data.companyId || data.organizationId || "", locationId: data.locationId || data.primaryLocationId || "" }) },
  { name: "live_user_profiles", groupBy: (_doc, data) => ({ companyId: data.companyId || data.organizationId || "", locationId: data.locationId || data.primaryLocationId || "" }) },
  { name: "task_templates", groupBy: (_doc, data) => ({ companyId: data.companyId || data.organizationId || "", locationId: data.locationId || "" }) },
  { name: "verification_templates", groupBy: (_doc, data) => ({ companyId: data.companyId || data.organizationId || "", locationId: data.locationId || "" }) },
  { name: "equipment", groupBy: (_doc, data) => ({ companyId: data.companyId || data.organizationId || "", locationId: data.locationId || "" }) },
  { name: "onboarding_answers", groupBy: (_doc, data) => ({ companyId: data.companyId || data.organizationId || "", locationId: data.locationId || "" }) },
  { name: "haccp_snapshots", groupBy: (_doc, data) => ({ companyId: data.companyId || data.organizationId || "", locationId: data.locationId || "" }) }
];

const COLLECTION_GROUPS = [
  {
    name: "companies/*/members",
    collectionId: "members",
    include: (doc) => doc.ref.parent.parent && doc.ref.parent.parent.parent.id === "companies",
    groupBy: (doc, data) => ({
      companyId: data.companyId || data.organizationId || doc.ref.parent.parent.id,
      locationId: data.locationId || data.primaryLocationId || ""
    })
  },
  {
    name: "companies/*/locations",
    collectionId: "locations",
    include: (doc) => doc.ref.parent.parent && doc.ref.parent.parent.parent.id === "companies",
    groupBy: (doc, data) => ({
      companyId: data.companyId || data.organizationId || doc.ref.parent.parent.id,
      locationId: data.locationId || doc.id
    })
  },
  {
    name: "companies/*/locations/*/risk_analysis/current",
    collectionId: "risk_analysis",
    include: (doc) => doc.id === "current" && doc.ref.parent.parent && doc.ref.parent.parent.parent.id === "locations",
    groupBy: (doc, data) => {
      const locationRef = doc.ref.parent.parent;
      const companyRef = locationRef.parent.parent;
      return {
        companyId: data.companyId || data.organizationId || companyRef.id,
        locationId: data.locationId || locationRef.id
      };
    }
  }
];

function groupKey(scope) {
  return `${scope.companyId || "(missing-company)"} / ${scope.locationId || "(company-scope)"}`;
}

function labelMatches(data) {
  if (!isValidOwnerKind(data.ownerKind)) return true;
  return data.ownerLabel === OWNER_LABEL[data.ownerKind];
}

function ensureGroup(map, key) {
  if (!map.has(key)) {
    map.set(key, {
      total: 0,
      ownerKindCounts: {},
      missingOwnerKind: [],
      invalidOwnerKind: [],
      labelMismatches: []
    });
  }
  return map.get(key);
}

function samplePush(list, value) {
  if (list.length < 20) list.push(value);
}

async function auditQuery(label, query, groupBy, include = () => true) {
  const snap = await query.get();
  const groups = new Map();

  for (const doc of snap.docs) {
    if (!include(doc)) continue;
    const data = doc.data() || {};
    const scope = groupBy(doc, data);
    const group = ensureGroup(groups, groupKey(scope));
    const ownerKind = data.ownerKind || "";

    group.total++;
    if (!ownerKind) {
      samplePush(group.missingOwnerKind, doc.ref.path);
    } else if (!isValidOwnerKind(ownerKind)) {
      samplePush(group.invalidOwnerKind, `${doc.ref.path} ownerKind=${ownerKind}`);
    } else {
      group.ownerKindCounts[ownerKind] = (group.ownerKindCounts[ownerKind] || 0) + 1;
    }

    if (!labelMatches(data)) {
      samplePush(group.labelMismatches, `${doc.ref.path} ownerKind=${data.ownerKind} ownerLabel=${data.ownerLabel || "(missing)"}`);
    }
  }

  printSection(label, groups);
}

function printSection(label, groups) {
  console.log(`\n=== ${label} ===`);
  if (groups.size === 0) {
    console.log("No documents found.");
    return;
  }

  for (const [key, group] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const ownerKinds = Object.keys(group.ownerKindCounts);
    const mixed = ownerKinds.length > 1;
    console.log(`\n${key}`);
    console.log(`  total: ${group.total}`);
    console.log(`  ownerKind counts: ${JSON.stringify(group.ownerKindCounts)}`);
    if (mixed) console.log("  MIXED OWNER SCOPES");
    if (group.missingOwnerKind.length) {
      console.log(`  missing ownerKind: ${group.missingOwnerKind.length} sample(s)`);
      group.missingOwnerKind.forEach((item) => console.log(`    - ${item}`));
    }
    if (group.invalidOwnerKind.length) {
      console.log(`  invalid ownerKind: ${group.invalidOwnerKind.length} sample(s)`);
      group.invalidOwnerKind.forEach((item) => console.log(`    - ${item}`));
    }
    if (group.labelMismatches.length) {
      console.log(`  ownerLabel mismatch: ${group.labelMismatches.length} sample(s)`);
      group.labelMismatches.forEach((item) => console.log(`    - ${item}`));
    }
  }
}

async function main() {
  console.log(`Project: ${serviceAccount.project_id}`);
  console.log("Mode: AUDIT ONLY - no writes");

  for (const config of ROOT_COLLECTIONS) {
    await auditQuery(config.name, db.collection(config.name), config.groupBy);
  }

  for (const config of COLLECTION_GROUPS) {
    await auditQuery(
      config.name,
      db.collectionGroup(config.collectionId),
      config.groupBy,
      config.include
    );
  }
}

main().catch((error) => {
  console.error("auditOwnerScopes failed:", error);
  process.exitCode = 1;
});
