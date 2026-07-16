const OWNER_KIND = Object.freeze({
  DEMO_OWNER: "demo_owner",
  REAL_OWNER: "real_owner"
});

const OWNER_LABEL = Object.freeze({
  [OWNER_KIND.DEMO_OWNER]: "Demo owner",
  [OWNER_KIND.REAL_OWNER]: "Rigtig owner"
});

function normalizeOwnerKind(input) {
  const value = String(input || "").trim();
  if (value === OWNER_KIND.DEMO_OWNER || value === OWNER_KIND.REAL_OWNER) {
    return value;
  }
  throw new Error(`Invalid ownerKind: ${value || "(empty)"}`);
}

function buildOwnerScopeMetadata(ownerKind) {
  const normalized = normalizeOwnerKind(ownerKind);

  if (normalized === OWNER_KIND.DEMO_OWNER) {
    return {
      ownerKind: OWNER_KIND.DEMO_OWNER,
      ownerLabel: OWNER_LABEL[OWNER_KIND.DEMO_OWNER],
      isDemoScope: true,
      scopeType: "demo"
    };
  }

  if (normalized === OWNER_KIND.REAL_OWNER) {
    return {
      ownerKind: OWNER_KIND.REAL_OWNER,
      ownerLabel: OWNER_LABEL[OWNER_KIND.REAL_OWNER],
      isDemoScope: false,
      scopeType: "customer"
    };
  }

  throw new Error(`Invalid ownerKind: ${normalized}`);
}

function isValidOwnerKind(input) {
  try {
    normalizeOwnerKind(input);
    return true;
  } catch (_) {
    return false;
  }
}

module.exports = {
  OWNER_KIND,
  OWNER_LABEL,
  buildOwnerScopeMetadata,
  normalizeOwnerKind,
  isValidOwnerKind
};
