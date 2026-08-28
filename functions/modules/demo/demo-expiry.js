const DEMO_DURATION_MS = 60 * 60 * 1000;

function toMillis(value) {
  if (!value) return Number.NaN;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.toDate === "function") return value.toDate().getTime();
  if (value instanceof Date) return value.getTime();
  return new Date(value).getTime();
}

function getDemoExpiresAt(now = Date.now()) {
  const nowMs = now instanceof Date ? now.getTime() : Number(now);
  return new Date(nowMs + DEMO_DURATION_MS);
}

function isExpiredDemo(data = {}, now = Date.now()) {
  if (data.isDemo !== true && data.demoMode !== true) return false;
  const expiresAtMs = toMillis(data.demoExpiresAt);
  const nowMs = now instanceof Date ? now.getTime() : Number(now);
  return !Number.isFinite(expiresAtMs) || expiresAtMs <= nowMs;
}

function buildExpiryPatch(expiredAt) {
  return {
    active: false,
    isActive: false,
    archived: true,
    status: "inactive",
    demoMode: false,
    archivedReason: "demo_expired",
    archivedAt: expiredAt,
    demoExpiredAt: expiredAt,
    updatedAt: expiredAt
  };
}

module.exports = {
  DEMO_DURATION_MS,
  buildExpiryPatch,
  getDemoExpiresAt,
  isExpiredDemo,
  toMillis
};
