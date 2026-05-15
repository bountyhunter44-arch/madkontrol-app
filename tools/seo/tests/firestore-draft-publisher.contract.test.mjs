import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  SEO_GENERATOR_CONFIGS_COLLECTION,
  SEO_PAGES_COLLECTION,
  getDraftSeoPage,
  saveDraftSeoPage,
  saveGeneratorConfig,
  updateDraftSeoPage
} from "../adapters/firestore/draft-publisher.js";

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
              writes.push({ type: "set", collection: name, id, payload, options });
            },
            async get() {
              const data = store.get(key);
              return {
                exists: data !== undefined,
                data: () => data
              };
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

const validPage = {
  pageId: "tenant-a__front",
  tenantId: "tenant-a",
  slug: "/front/",
  title: "Front page",
  metaDescription: "Front page description.",
  h1: "Front page",
  sections: [{ heading: "Intro", text: "Hello." }]
};

test("save draft SEO page", async () => {
  const db = createMockDb();
  const saved = await saveDraftSeoPage(db, validPage);

  assert.equal(saved.status, "draft");
  assert.equal(saved.slug, "front");
  assertIsoTimestamp(saved.createdAt);
  assertIsoTimestamp(saved.updatedAt);
  assert.deepEqual(db.writes[0], {
    type: "set",
    collection: SEO_PAGES_COLLECTION,
    id: "tenant-a__front",
    payload: saved,
    options: { merge: true }
  });
});

test("update draft SEO page", async () => {
  const db = createMockDb();
  await saveDraftSeoPage(db, validPage);
  const patch = await updateDraftSeoPage(db, "tenant-a__front", {
    title: "Updated title",
    status: "review"
  });
  const fetched = await getDraftSeoPage(db, "tenant-a__front");

  assert.equal(patch.pageId, "tenant-a__front");
  assertIsoTimestamp(patch.updatedAt);
  assert.equal(fetched.title, "Updated title");
  assert.equal(fetched.status, "review");
  assert.equal(fetched.tenantId, "tenant-a");
});

test("fetch draft SEO page", async () => {
  const db = createMockDb();
  assert.equal(await getDraftSeoPage(db, "missing"), null);

  await saveDraftSeoPage(db, validPage);
  const fetched = await getDraftSeoPage(db, "tenant-a__front");
  assert.equal(fetched.pageId, "tenant-a__front");
  assert.equal(fetched.h1, "Front page");
});

test("validation and missing fields", async () => {
  const db = createMockDb();
  await assert.rejects(
    () => saveDraftSeoPage(db, { ...validPage, title: "" }),
    /title/
  );
  await assert.rejects(
    () => updateDraftSeoPage(db, "", { title: "No id" }),
    /pageId/
  );
  await assert.rejects(
    () => saveDraftSeoPage(null, validPage),
    /requires a db/
  );
});

test("save generator config", async () => {
  const db = createMockDb();
  const saved = await saveGeneratorConfig(db, {
    tenantId: "tenant-a",
    productId: "product-a",
    domain: "https://tenant.example",
    language: "da",
    country: "DK",
    topics: ["takeaway"],
    publisher: "firestore-draft"
  });

  assert.equal(saved.configId, "tenant-a__product-a__https_tenant_example");
  assert.equal(saved.publisher, "firestore-draft");
  assertIsoTimestamp(saved.createdAt);
  assertIsoTimestamp(saved.updatedAt);
  assert.equal(db.writes[0].collection, SEO_GENERATOR_CONFIGS_COLLECTION);
  assert.equal(db.writes[0].id, saved.configId);
  assert.deepEqual(db.writes[0].options, { merge: true });
});

test("generator config missing fields", async () => {
  const db = createMockDb();
  await assert.rejects(
    () => saveGeneratorConfig(db, { tenantId: "tenant-a", domain: "https://tenant.example" }),
    /language, country/
  );
});

test("no Firebase dependency", () => {
  const source = readFileSync(resolve("tools/seo/adapters/firestore/draft-publisher.js"), "utf8");
  assert.doesNotMatch(
    source,
    /from\s+["']firebase|require\(["']firebase|firebase-admin|initializeApp|httpsCallable/i
  );
});
