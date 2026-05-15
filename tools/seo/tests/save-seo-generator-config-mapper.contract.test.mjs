import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  mapSaveSeoGeneratorConfigPayload,
  saveSeoGeneratorConfigDraft
} from "../adapters/firestore/save-seo-generator-config-mapper.js";

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

function assertIsoTimestamp(value) {
  assert.equal(typeof value, "string");
  assert.match(value, /^\d{4}-\d{2}-\d{2}T/);
}

const callablePayload = {
  data: {
    companyId: "company-a",
    locationId: "location-a",
    configId: "existing-config-id",
    config: {
      businessName: "Aroi D",
      subdomain: "aroi-d",
      city: "Hvidovre",
      cuisineType: "Thai",
      offerings: "takeaway og restaurant",
      keyword: "thai mad hvidovre",
      phone: "12345678",
      address: "Hovedgade 1",
      description: "Autentisk thai.",
      selectedTemplate: "classic",
      pageCount: 12,
      logoPosition: "card",
      seoNarrative: "Thai restaurant i Hvidovre.",
      heroImageUrl: "https://img.example/hero.jpg",
      ctaText: "Bestil",
      ctaUrl: "https://order.example",
      landingPages: [
        {
          canonicalPath: "/thai-hvidovre",
          keyword: "thai hvidovre",
          title: "Thai i Hvidovre",
          h1: "Thai Hvidovre",
          h2: "Frisk thai",
          h3: "Bestil online",
          metaDescription: "Thai mad i Hvidovre."
        }
      ]
    }
  }
};

test("maps existing saveSeoGeneratorConfig callable payload shape", () => {
  const mapped = mapSaveSeoGeneratorConfigPayload(callablePayload, {
    baseDomain: "madkontrollen.dk"
  });

  assert.equal(mapped.configId, "existing-config-id");
  assert.equal(mapped.tenantId, "company-a");
  assert.equal(mapped.productId, "location-a");
  assert.equal(mapped.domain, "https://aroi-d.madkontrollen.dk");
  assert.equal(mapped.language, "da");
  assert.equal(mapped.country, "DK");
  assert.equal(mapped.publisher, "firestore-draft");
  assert.equal(mapped.monthlyPageLimit, 12);
  assert.deepEqual(mapped.channels, ["website", "seo"]);
  assert.deepEqual(mapped.topics, ["thai hvidovre"]);
  assert.equal(mapped.companyId, "company-a");
  assert.equal(mapped.organizationId, "company-a");
  assert.equal(mapped.locationId, "location-a");
  assert.equal(mapped.landingPages.length, 1);
});

test("saves mapped payload through shared draft publisher", async () => {
  const db = createMockDb();
  const saved = await saveSeoGeneratorConfigDraft(db, callablePayload, {
    baseDomain: "madkontrollen.dk"
  });

  assert.equal(saved.configId, "existing-config-id");
  assertIsoTimestamp(saved.createdAt);
  assertIsoTimestamp(saved.updatedAt);
  assert.equal(db.writes.length, 1);
  assert.equal(db.writes[0].collection, "seo_generator_configs");
  assert.equal(db.writes[0].id, "existing-config-id");
  assert.deepEqual(db.writes[0].options, { merge: true });
});

test("accepts direct payload and explicit domain", () => {
  const mapped = mapSaveSeoGeneratorConfigPayload({
    companyId: "company-b",
    locationId: "location-b",
    config: {
      businessName: "Cafe B",
      domain: "https://cafe.example",
      language: "en",
      country: "US"
    }
  });

  assert.equal(mapped.configId, "company-b__location-b__cafe-b");
  assert.equal(mapped.domain, "https://cafe.example");
  assert.equal(mapped.language, "en");
  assert.equal(mapped.country, "US");
});

test("validates missing legacy payload fields", () => {
  assert.throws(
    () => mapSaveSeoGeneratorConfigPayload({ companyId: "company-a", config: {} }),
    /locationId, domain/
  );
  assert.throws(
    () => mapSaveSeoGeneratorConfigPayload(null),
    /payload must be an object/
  );
});

test("does not import Firebase", () => {
  const source = readFileSync(
    resolve("tools/seo/adapters/firestore/save-seo-generator-config-mapper.js"),
    "utf8"
  );
  assert.doesNotMatch(
    source,
    /from\s+["']firebase|require\(["']firebase|firebase-admin|initializeApp|httpsCallable/i
  );
});
