import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createSaveSeoGeneratorConfigRuntimeWrapper } from "../adapters/firestore/save-seo-generator-config-runtime-wrapper.js";

function createMockDb() {
  const store = new Map();
  const writes = [];
  return {
    store,
    writes,
    collection(name) {
      return {
        doc(id) {
          const key = `${name}/${id}`;
          return {
            async set(payload, options) {
              const existing = store.get(key) || {};
              store.set(key, options?.merge ? { ...existing, ...payload } : payload);
              writes.push({ collection: name, id, payload, options });
            }
          };
        }
      };
    }
  };
}

function test(name, fn) {
  Promise.resolve()
    .then(fn)
    .then(() => console.log(`ok - ${name}`))
    .catch((error) => {
      console.error(`not ok - ${name}`);
      console.error(error);
      process.exitCode = 1;
    });
}

const legacyPayload = {
  companyId: "company-a",
  locationId: "location-a",
  configId: "company-a__location-a__existing",
  config: {
    businessName: "Aroi D",
    subdomain: "aroi-d",
    city: "Hvidovre",
    cuisineType: "Thai",
    keyword: "thai hvidovre",
    pageCount: 25,
    landingPages: [
      {
        canonicalPath: "/thai-hvidovre",
        keyword: "thai hvidovre",
        title: "Thai Hvidovre",
        h1: "Thai Hvidovre",
        metaDescription: "Thai mad i Hvidovre."
      }
    ]
  }
};

test("preserves callable signature and return shape for legacy payload", async () => {
  const db = createMockDb();
  const accessCalls = [];
  const handler = createSaveSeoGeneratorConfigRuntimeWrapper({
    db,
    baseDomain: "madkontrollen.dk",
    assertSeoGeneratorAccess: async (scope) => accessCalls.push(scope)
  });

  const result = await handler(legacyPayload, {
    auth: { uid: "uid-1", token: { email: "admin@example.test" } }
  });

  assert.deepEqual(result, {
    ok: true,
    configId: "company-a__location-a__existing",
    subdomain: "aroi-d"
  });
  assert.deepEqual(accessCalls, [
    {
      uid: "uid-1",
      email: "admin@example.test",
      companyId: "company-a",
      locationId: "location-a"
    }
  ]);
  assert.equal(db.writes.length, 1);
  assert.equal(db.writes[0].collection, "seo_generator_configs");
  assert.equal(db.writes[0].id, "company-a__location-a__existing");
  assert.equal(db.writes[0].payload.tenantId, "company-a");
  assert.equal(db.writes[0].payload.productId, "location-a");
  assert.equal(db.writes[0].payload.domain, "https://aroi-d.madkontrollen.dk");
  assert.deepEqual(db.writes[0].payload.topics, ["thai hvidovre"]);
});

test("accepts wrapped callable data payload", async () => {
  const db = createMockDb();
  const handler = createSaveSeoGeneratorConfigRuntimeWrapper({
    db,
    baseDomain: "madkontrollen.dk"
  });

  const result = await handler({ data: legacyPayload }, {
    auth: { uid: "uid-1", token: {} }
  });

  assert.equal(result.configId, "company-a__location-a__existing");
  assert.equal(db.writes[0].payload.sourcePayloadType, "saveSeoGeneratorConfig");
});

test("keeps onboarding auth bypass behavior", async () => {
  const db = createMockDb();
  let accessCalled = false;
  const handler = createSaveSeoGeneratorConfigRuntimeWrapper({
    db,
    baseDomain: "madkontrollen.dk",
    assertSeoGeneratorAccess: async () => {
      accessCalled = true;
    }
  });

  const result = await handler({
    ...legacyPayload,
    companyId: "onboarding_company",
    configId: "onboarding-config"
  }, {});

  assert.equal(result.ok, true);
  assert.equal(accessCalled, false);
});

test("validates missing auth and required ids", async () => {
  const db = createMockDb();
  const handler = createSaveSeoGeneratorConfigRuntimeWrapper({
    db,
    baseDomain: "madkontrollen.dk"
  });

  await assert.rejects(
    () => handler(legacyPayload, {}),
    /Log ind/
  );
  await assert.rejects(
    () => handler({ ...legacyPayload, locationId: "" }, { auth: { uid: "uid-1" } }),
    /companyId og locationId/
  );
});

test("does not import Firebase", () => {
  const source = readFileSync(
    resolve("tools/seo/adapters/firestore/save-seo-generator-config-runtime-wrapper.js"),
    "utf8"
  );
  assert.doesNotMatch(
    source,
    /from\s+["']firebase|require\(["']firebase|firebase-admin|initializeApp|httpsCallable/i
  );
});
