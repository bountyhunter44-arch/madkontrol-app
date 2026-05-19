import assert from "node:assert/strict";
import {
  buildRobotsResponse,
  buildSitemapResponse,
  createSeoGatewayApp,
  invalidateSeoCache,
  parseSeoRequest,
  resolveSeoResponse,
  slugifySeoPathPart
} from "./seo-gateway.js";

function createDoc(id, data) {
  return { id, data: () => data };
}

function createQuerySnapshot(docs) {
  return { empty: docs.length === 0, docs };
}

function createCollection(name, fixtures) {
  const filters = [];
  const api = {
    where(field, op, value) {
      filters.push({ field, op, value });
      return api;
    },
    orderBy() {
      return api;
    },
    limit() {
      return api;
    },
    async get() {
      const rows = fixtures[name] || [];
      const filtered = rows.filter((row) => filters.every((filter) => row[filter.field] === filter.value));
      return createQuerySnapshot(filtered.map((row) => createDoc(row.id, row)));
    }
  };
  return api;
}

function createDb(fixtures) {
  return {
    collection(name) {
      return createCollection(name, fixtures);
    }
  };
}

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
  });
}

const parsed = parseSeoRequest({
  host: "herning.madkontrollen.dk",
  path: "/aroi-d/"
});

assert.equal(slugifySeoPathPart("Ørnhøj"), "oernhoej");
assert.equal(slugifySeoPathPart("Sønderborg"), "soenderborg");
assert.equal(slugifySeoPathPart("Århus"), "aarhus");
assert.equal(slugifySeoPathPart("Aarhus"), "aarhus");
assert.equal(parsed.ok, true);
assert.equal(parsed.citySlug, "herning");
assert.equal(parsed.businessSlug, "aroi-d");
assert.equal(parsed.virtualOutputPath, "herning/aroi-d/index.html");
assert.equal(parsed.canonicalUrl, "https://herning.madkontrollen.dk/aroi-d/");

const sitemap = buildSitemapResponse(parsed);
assert.match(sitemap, /<urlset/);
assert.match(sitemap, /https:\/\/herning\.madkontrollen\.dk\/aroi-d\//);

const robots = buildRobotsResponse(parsed);
assert.match(robots, /Sitemap: https:\/\/herning\.madkontrollen\.dk\/aroi-d\/sitemap\.xml/);

const db = createDb({
  websites: [{
    id: "site_1",
    citySlug: "herning",
    businessSlug: "aroi-d",
    status: "published",
    heroTitle: "Aroi-D",
    heroText: "Thai restaurant i Ørnhøj"
  }],
  seo_pages: [{
    id: "page_1",
    websiteId: "site_1",
    status: "published",
    ordering: 1,
    outputPath: "herning/aroi-d/index.html",
    slug: "herning/aroi-d",
    canonicalPath: "/herning/aroi-d/",
    title: "Aroi-D | Thai restaurant i Ørnhøj",
    h1: "Thai restaurant i Ørnhøj",
    metaDescription: "Autentisk Thai restaurant i Ørnhøj"
  }]
});

const htmlResponse = await resolveSeoResponse({
  db,
  host: "herning.madkontrollen.dk",
  path: "/aroi-d/",
  query: {},
  logger: { info() {}, error() {}, warn() {} }
});
assert.equal(htmlResponse.status, 200);
assert.match(htmlResponse.body, /Thai restaurant i Ørnhøj/);
assert.match(htmlResponse.body, /https:\/\/herning\.madkontrollen\.dk\/aroi-d\//);

const xmlResponse = await resolveSeoResponse({
  db,
  host: "herning.madkontrollen.dk",
  path: "/aroi-d/sitemap.xml",
  query: {},
  logger: { info() {}, error() {}, warn() {} }
});
assert.equal(xmlResponse.contentType, "application/xml; charset=utf-8");

const robotsResponse = await resolveSeoResponse({
  db,
  host: "herning.madkontrollen.dk",
  path: "/aroi-d/robots.txt",
  query: { nocache: "1" },
  logger: { info() {}, error() {}, warn() {} }
});
assert.equal(robotsResponse.contentType, "text/plain; charset=utf-8");
assert.equal(robotsResponse.cacheHit, undefined);

const missingCustomer = await resolveSeoResponse({
  db,
  host: "herning.madkontrollen.dk",
  path: "/ukendt/",
  query: {},
  logger: { info() {}, error() {}, warn() {} }
});
assert.equal(missingCustomer.status, 404);

const unknownSubdomain = await resolveSeoResponse({
  db,
  host: "www.madkontrollen.dk",
  path: "/aroi-d/",
  query: {},
  logger: { info() {}, error() {}, warn() {} }
});
assert.equal(unknownSubdomain.status, 404);

invalidateSeoCache({ citySlug: "herning", businessSlug: "aroi-d" });
const cachedFirstResponse = await resolveSeoResponse({
  db,
  host: "herning.madkontrollen.dk",
  path: "/aroi-d/",
  query: {},
  logger: { info() {}, error() {}, warn() {} }
});
assert.equal(cachedFirstResponse.cacheHit, undefined);

const fixtures = {
  websites: [{
    id: "site_cache",
    citySlug: "herning",
    businessSlug: "aroi-d-cache",
    status: "published",
    heroTitle: "Aroi-D Cache",
    heroText: "Thai restaurant i Herning",
    publishVersion: "v1"
  }],
  seo_pages: [{
    id: "page_cache",
    websiteId: "site_cache",
    status: "published",
    ordering: 1,
    outputPath: "herning/aroi-d-cache/index.html",
    slug: "herning/aroi-d-cache",
    canonicalPath: "/herning/aroi-d-cache/",
    title: "Aroi-D Cache | Version 1",
    h1: "Aroi-D Cache Version 1"
  }]
};
const cacheDb = createDb(fixtures);
const firstCacheResponse = await resolveSeoResponse({
  db: cacheDb,
  host: "herning.madkontrollen.dk",
  path: "/aroi-d-cache/",
  query: {},
  logger: { info() {}, error() {}, warn() {} }
});
assert.match(firstCacheResponse.body, /Version 1/);

fixtures.seo_pages[0].title = "Aroi-D Cache | Version 2";
fixtures.seo_pages[0].h1 = "Aroi-D Cache Version 2";
const cacheHitResponse = await resolveSeoResponse({
  db: cacheDb,
  host: "herning.madkontrollen.dk",
  path: "/aroi-d-cache/",
  query: {},
  logger: { info() {}, error() {}, warn() {} }
});
assert.equal(cacheHitResponse.cacheHit, true);
assert.match(cacheHitResponse.body, /Version 1/);

const removed = invalidateSeoCache({ citySlug: "herning", businessSlug: "aroi-d-cache" });
assert.equal(removed > 0, true);
const invalidatedResponse = await resolveSeoResponse({
  db: cacheDb,
  host: "herning.madkontrollen.dk",
  path: "/aroi-d-cache/",
  query: {},
  logger: { info() {}, error() {}, warn() {} }
});
assert.equal(invalidatedResponse.cacheHit, undefined);
assert.match(invalidatedResponse.body, /Version 2/);

process.env.SEO_GATEWAY_INTERNAL_TOKEN = "test-token";
const app = await createSeoGatewayApp({
  db: cacheDb,
  logger: { info() {}, error() {}, warn() {} }
});
const server = await listen(app);
try {
  const port = server.address().port;
  const badTokenResponse = await fetch(`http://127.0.0.1:${port}/__internal/seo-cache/invalidate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer wrong-token"
    },
    body: JSON.stringify({ citySlug: "herning", businessSlug: "aroi-d-cache" })
  });
  assert.equal(badTokenResponse.status, 401);

  const goodTokenResponse = await fetch(`http://127.0.0.1:${port}/__internal/seo-cache/invalidate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer test-token"
    },
    body: JSON.stringify({ citySlug: "herning", businessSlug: "aroi-d-cache" })
  });
  assert.equal(goodTokenResponse.status, 200);
  const payload = await goodTokenResponse.json();
  assert.equal(payload.ok, true);
} finally {
  await new Promise((resolve) => server.close(resolve));
}

console.log("seo-gateway tests passed");
