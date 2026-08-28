const test = require("node:test");
const assert = require("node:assert/strict");
const {
  DEMO_DURATION_MS,
  buildExpiryPatch,
  getDemoExpiresAt,
  isExpiredDemo
} = require("./demo-expiry");

test("demo duration is exactly one hour", () => {
  const now = Date.UTC(2026, 7, 26, 10, 0, 0);
  assert.equal(getDemoExpiresAt(now).getTime() - now, DEMO_DURATION_MS);
  assert.equal(DEMO_DURATION_MS, 3_600_000);
});

test("demo expires at the boundary", () => {
  const expiresAt = new Date("2026-08-26T11:00:00.000Z");
  const data = { isDemo: true, demoExpiresAt: expiresAt };
  assert.equal(isExpiredDemo(data, expiresAt.getTime() - 1), false);
  assert.equal(isExpiredDemo(data, expiresAt.getTime()), true);
});

test("missing expiry fails closed for demo profiles only", () => {
  assert.equal(isExpiredDemo({ isDemo: true }), true);
  assert.equal(isExpiredDemo({ status: "active" }), false);
});

test("expiry patch soft-archives without delete semantics", () => {
  const expiredAt = new Date("2026-08-26T11:00:00.000Z");
  assert.deepEqual(buildExpiryPatch(expiredAt), {
    active: false,
    isActive: false,
    archived: true,
    status: "inactive",
    demoMode: false,
    archivedReason: "demo_expired",
    archivedAt: expiredAt,
    demoExpiredAt: expiredAt,
    updatedAt: expiredAt
  });
});
