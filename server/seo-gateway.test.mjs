import assert from "node:assert/strict";
import http from "node:http";
import {
  buildRobotsResponse,
  buildSitemapResponse,
  createSeoGatewayApp,
  invalidateSeoCache,
  parseSeoRequest,
  resolveStaticSeoFileResponse,
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

function requestWithHost({ port, host, path = "/" }) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: "127.0.0.1",
      port,
      path,
      method: "GET",
      headers: { Host: host }
    }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on("error", reject);
    req.end();
  });
}

const businessRoot = parseSeoRequest({
  host: "aroi-d.madkontrollen.dk",
  path: "/"
});
const cityRoute = parseSeoRequest({
  host: "aroi-d.madkontrollen.dk",
  path: "/herning/"
});
const legacyRoute = parseSeoRequest({
  host: "herning.madkontrollen.dk",
  path: "/aroi-d/"
});

assert.equal(slugifySeoPathPart("Ørnhøj"), "oernhoej");
assert.equal(slugifySeoPathPart("Sønderborg"), "soenderborg");
assert.equal(slugifySeoPathPart("Århus"), "aarhus");
assert.equal(slugifySeoPathPart("Aarhus"), "aarhus");
assert.equal(businessRoot.ok, true);
assert.equal(businessRoot.citySlug, "");
assert.equal(businessRoot.businessSlug, "aroi-d");
assert.equal(businessRoot.virtualOutputPath, "aroi-d/index.html");
assert.equal(businessRoot.canonicalUrl, "https://aroi-d.madkontrollen.dk/");
assert.equal(cityRoute.ok, true);
assert.equal(cityRoute.citySlug, "herning");
assert.equal(cityRoute.businessSlug, "aroi-d");
assert.equal(cityRoute.virtualOutputPath, "herning/aroi-d/index.html");
assert.equal(cityRoute.canonicalUrl, "https://aroi-d.madkontrollen.dk/herning/");
assert.equal(legacyRoute.ok, true);
assert.equal(legacyRoute.legacyCandidate.citySlug, "herning");
assert.equal(legacyRoute.legacyCandidate.businessSlug, "aroi-d");

const staticRootResponse = await resolveStaticSeoFileResponse({
  host: "aroi-d.madkontrollen.dk",
  path: "/"
});
assert.equal(staticRootResponse.status, 200);
assert.equal(staticRootResponse.contentType, "text/html; charset=utf-8");
assert.match(staticRootResponse.body, /Aroi D|Aroi-D/);

const staticRobotsResponse = await resolveStaticSeoFileResponse({
  host: "aroi-d.madkontrollen.dk",
  path: "/robots.txt"
});
assert.equal(staticRobotsResponse.status, 200);
assert.equal(staticRobotsResponse.contentType, "text/plain; charset=utf-8");
assert.match(staticRobotsResponse.body, /Sitemap: https:\/\/aroi-d\.madkontrollen\.dk\/sitemap\.xml/);

const staticSitemapResponse = await resolveStaticSeoFileResponse({
  host: "aroi-d.madkontrollen.dk",
  path: "/sitemap.xml"
});
assert.equal(staticSitemapResponse.status, 200);
assert.equal(staticSitemapResponse.contentType, "application/xml; charset=utf-8");
assert.match(staticSitemapResponse.body, /https:\/\/aroi-d\.madkontrollen\.dk\//);

const sitemap = buildSitemapResponse(cityRoute);
assert.match(sitemap, /<urlset/);
assert.match(sitemap, /https:\/\/aroi-d\.madkontrollen\.dk\//);
assert.match(sitemap, /https:\/\/aroi-d\.madkontrollen\.dk\/herning\//);
assert.doesNotMatch(sitemap, /\.html/);

const robots = buildRobotsResponse(businessRoot);
assert.match(robots, /Sitemap: https:\/\/aroi-d\.madkontrollen\.dk\/sitemap\.xml/);

const db = createDb({
  websites: [{
    id: "site_1",
    domain: "aroi-d.madkontrollen.dk",
    citySlug: "herning",
    businessSlug: "aroi-d",
    status: "published",
    heroTitle: "Aroi-D",
    heroText: "Thai restaurant i Ørnhøj"
  }],
  seo_pages: [{
    id: "page_root",
    websiteId: "site_1",
    status: "published",
    ordering: 1,
    pageType: "business_root",
    routePath: "/",
    canonicalPath: "/",
    outputPath: "aroi-d/index.html",
    slug: "root",
    businessSlug: "aroi-d",
    title: "Aroi-D",
    h1: "Aroi-D",
    metaDescription: "Aroi-D business root",
    bodyText: "Business root content"
  }, {
    id: "page_1",
    websiteId: "site_1",
    status: "published",
    ordering: 2,
    pageType: "city_landing",
    routePath: "/herning/",
    citySlug: "herning",
    businessSlug: "aroi-d",
    outputPath: "herning/aroi-d/index.html",
    slug: "herning/aroi-d",
    canonicalPath: "/herning/aroi-d/",
    bodyText: "Herning city landing content",
    title: "Aroi-D | Thai restaurant i Ørnhøj",
    h1: "Thai restaurant i Ørnhøj",
    metaDescription: "Autentisk Thai restaurant i Ørnhøj"
  }, {
    id: "page_oernhoej",
    websiteId: "site_1",
    status: "published",
    ordering: 3,
    pageType: "city_landing",
    routePath: "/oernhoej/",
    outputPath: "oernhoej/aroi-d/index.html",
    slug: "oernhoej",
    canonicalPath: "/oernhoej/",
    citySlug: "oernhoej",
    businessSlug: "aroi-d",
    title: "Aroi-D i Oernhoej",
    h1: "Aroi-D i Oernhoej",
    metaDescription: "Aroi-D city landing for Oernhoej",
    bodyText: "Oernhoej unique city landing content"
  }]
});

const unicodeDb = createDb({
  websites: [{
    id: "site_unicode",
    citySlug: "oernhoej",
    businessSlug: "aroi-d-unicode",
    cityName: "Ørnhøj",
    displayCityName: "Ørnhøj",
    businessName: "Aroi-D",
    displayBusinessName: "Aroi-D",
    status: "published",
    heroTitle: "Aroi-D",
    heroText: "Thai restaurant i Ørnhøj"
  }],
  seo_pages: [{
    id: "page_unicode",
    websiteId: "site_unicode",
    status: "published",
    ordering: 1,
    outputPath: "oernhoej/aroi-d-unicode/index.html",
    slug: "oernhoej/aroi-d-unicode",
    canonicalPath: "/oernhoej/aroi-d-unicode/",
    citySlug: "oernhoej",
    businessSlug: "aroi-d-unicode",
    cityName: "Ørnhøj",
    displayCityName: "Ørnhøj",
    businessName: "Aroi-D",
    displayBusinessName: "Aroi-D",
    title: "Aroi-D | Thai restaurant i Ørnhøj",
    h1: "Thai restaurant i Ørnhøj",
    h2: "Hvorfor vælge Aroi-D i Ørnhøj?",
    metaDescription: "Autentisk Thai restaurant i Ørnhøj",
    bodyText: "Hvorfor vælge Aroi-D i Ørnhøj? Friske råvarer og ægte smag."
  }]
});

const unicodeResponse = await resolveSeoResponse({
  db: unicodeDb,
  host: "aroi-d-unicode.madkontrollen.dk",
  path: "/oernhoej/",
  query: {},
  logger: { info() {}, error() {}, warn() {} }
});
assert.equal(unicodeResponse.status, 200);
assert.match(unicodeResponse.body, /Ørnhøj/);
assert.match(unicodeResponse.body, /vælge/);
assert.doesNotMatch(unicodeResponse.body.replace(/https?:\/\/[^"'<\s]+/g, ""), /vaelge|Oernhoej/);
assert.match(unicodeResponse.body, /https:\/\/aroi-d-unicode\.madkontrollen\.dk\/oernhoej\//);

const htmlResponse = await resolveSeoResponse({
  db,
  host: "aroi-d.madkontrollen.dk",
  path: "/herning/",
  query: {},
  logger: { info() {}, error() {}, warn() {} }
});
assert.equal(htmlResponse.status, 200);
assert.match(htmlResponse.body, /Herning city landing content/);
assert.doesNotMatch(htmlResponse.body, /Business root content/);
assert.match(htmlResponse.body, /Thai restaurant i Ørnhøj/);
assert.match(htmlResponse.body, /https:\/\/aroi-d\.madkontrollen\.dk\/herning\//);

const businessRootResponse = await resolveSeoResponse({
  db,
  host: "aroi-d.madkontrollen.dk",
  path: "/",
  query: {},
  logger: { info() {}, error() {}, warn() {} }
});
assert.equal(businessRootResponse.status, 200);
assert.match(businessRootResponse.body, /Business root content/);
assert.doesNotMatch(businessRootResponse.body, /Herning city landing content/);
assert.match(businessRootResponse.body, /https:\/\/aroi-d\.madkontrollen\.dk\//);

const legacyResponse = await resolveSeoResponse({
  db,
  host: "herning.madkontrollen.dk",
  path: "/aroi-d/",
  query: {},
  logger: { info() {}, error() {}, warn() {} }
});
assert.equal(legacyResponse.status, 200);
assert.equal(legacyResponse.parsed.legacyRoute, true);
assert.match(legacyResponse.body, /https:\/\/aroi-d\.madkontrollen\.dk\/herning\//);

const xmlResponse = await resolveSeoResponse({
  db,
  host: "aroi-d.madkontrollen.dk",
  path: "/sitemap.xml",
  query: {},
  logger: { info() {}, error() {}, warn() {} }
});
assert.equal(xmlResponse.contentType, "application/xml; charset=utf-8");
assert.match(xmlResponse.body, /https:\/\/aroi-d\.madkontrollen\.dk\//);
assert.match(xmlResponse.body, /https:\/\/aroi-d\.madkontrollen\.dk\/herning\//);
assert.match(xmlResponse.body, /https:\/\/aroi-d\.madkontrollen\.dk\/oernhoej\//);
assert.doesNotMatch(xmlResponse.body, /\.html/);

const robotsResponse = await resolveSeoResponse({
  db,
  host: "aroi-d.madkontrollen.dk",
  path: "/robots.txt",
  query: { nocache: "1" },
  logger: { info() {}, error() {}, warn() {} }
});
assert.equal(robotsResponse.contentType, "text/plain; charset=utf-8");
assert.match(robotsResponse.body, /https:\/\/aroi-d\.madkontrollen\.dk\/sitemap\.xml/);
assert.equal(robotsResponse.cacheHit, undefined);

const missingCustomer = await resolveSeoResponse({
  db,
  host: "ukendt.madkontrollen.dk",
  path: "/",
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
  host: "aroi-d.madkontrollen.dk",
  path: "/herning/",
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
  host: "aroi-d-cache.madkontrollen.dk",
  path: "/herning/",
  query: {},
  logger: { info() {}, error() {}, warn() {} }
});
assert.match(firstCacheResponse.body, /Version 1/);

fixtures.seo_pages[0].title = "Aroi-D Cache | Version 2";
fixtures.seo_pages[0].h1 = "Aroi-D Cache Version 2";
const cacheHitResponse = await resolveSeoResponse({
  db: cacheDb,
  host: "aroi-d-cache.madkontrollen.dk",
  path: "/herning/",
  query: {},
  logger: { info() {}, error() {}, warn() {} }
});
assert.equal(cacheHitResponse.cacheHit, true);
assert.match(cacheHitResponse.body, /Version 1/);

const removed = invalidateSeoCache({ citySlug: "herning", businessSlug: "aroi-d-cache" });
assert.equal(removed > 0, true);
const invalidatedResponse = await resolveSeoResponse({
  db: cacheDb,
  host: "aroi-d-cache.madkontrollen.dk",
  path: "/herning/",
  query: {},
  logger: { info() {}, error() {}, warn() {} }
});
assert.equal(invalidatedResponse.cacheHit, undefined);
assert.match(invalidatedResponse.body, /Version 2/);

process.env.SEO_GATEWAY_INTERNAL_TOKEN = "test-token";
const app = await createSeoGatewayApp({
  db,
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

  const rebuildResponse = await fetch(`http://127.0.0.1:${port}/internal/rebuild-site`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer test-token"
    },
    body: JSON.stringify({ domain: "aroi-d.madkontrollen.dk", reason: "test" })
  });
  assert.equal(rebuildResponse.status, 200);
  const rebuildPayload = await rebuildResponse.json();
  assert.equal(rebuildPayload.ok, true);
  assert.equal(rebuildPayload.domain, "aroi-d.madkontrollen.dk");
} finally {
  await new Promise((resolve) => server.close(resolve));
}

const staticLogs = [];
const staticPriorityApp = await createSeoGatewayApp({
  db,
  logger: {
    info(message, details) { staticLogs.push({ message, details }); },
    error() {},
    warn() {}
  }
});
const staticPriorityServer = await listen(staticPriorityApp);
try {
  const port = staticPriorityServer.address().port;
  const response = await requestWithHost({
    port,
    host: "aroi-d.madkontrollen.dk",
    path: "/"
  });
  assert.equal(response.status, 200);
  assert.match(response.headers["content-type"] || "", /text\/html/);
  assert.equal(staticLogs.some((entry) => entry.message === "[seo-vps:static-index-hit]"), true);
  assert.equal(staticLogs.some((entry) => entry.message === "[seo-gateway] lookup"), false);
} finally {
  await new Promise((resolve) => staticPriorityServer.close(resolve));
}

console.log("seo-gateway tests passed");
