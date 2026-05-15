import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  generateSeoBundle,
  normalizeSeoPage,
  normalizeTenantSeoConfig
} from "../generator/core.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const seoRoot = resolve(__dirname, "..");

function readJson(relativePath) {
  return JSON.parse(readFileSync(resolve(seoRoot, relativePath), "utf8"));
}

function validateContract(schema, value) {
  const errors = [];

  for (const field of schema.required || []) {
    if (value[field] === undefined || value[field] === null || value[field] === "") {
      errors.push(`${field} is required`);
    }
  }

  for (const [field, definition] of Object.entries(schema.properties || {})) {
    if (value[field] === undefined || value[field] === null) continue;

    if (definition.type === "array" && !Array.isArray(value[field])) {
      errors.push(`${field} must be array`);
    }

    if (definition.type === "boolean" && typeof value[field] !== "boolean") {
      errors.push(`${field} must be boolean`);
    }

    if (definition.type === "number" && typeof value[field] !== "number") {
      errors.push(`${field} must be number`);
    }

    if (definition.type === "string" && typeof value[field] !== "string") {
      errors.push(`${field} must be string`);
    }

    if (definition.enum && !definition.enum.includes(value[field])) {
      errors.push(`${field} must be one of ${definition.enum.join(", ")}`);
    }
  }

  return errors;
}

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}

const tenantSchema = readJson("schema/tenant-seo-config.schema.json");
const pageSchema = readJson("schema/seo-page.schema.json");

test("tenant SEO config validation", () => {
  const config = normalizeTenantSeoConfig({
    tenantId: "tenant-a",
    productId: "madcore-seo",
    domain: "https://tenant.example",
    language: "da",
    country: "DK",
    industry: "foodservice",
    audience: "local guests",
    tone: "warm",
    topics: ["takeaway", "", "lunch"],
    blockedTopics: ["medical claims"],
    publisher: "firestore-draft",
    requireHumanApproval: true,
    billingPlan: "pro",
    monthlyPageLimit: "25",
    channels: ["website", "seo"]
  });

  assert.deepEqual(validateContract(tenantSchema, config), []);
  assert.deepEqual(config.topics, ["takeaway", "lunch"]);
  assert.equal(config.monthlyPageLimit, 25);
});

test("SEO page contract validation", () => {
  const tenantConfig = normalizeTenantSeoConfig({
    tenantId: "tenant-a",
    domain: "https://tenant.example",
    language: "da",
    country: "DK"
  });

  const page = normalizeSeoPage({
    slug: "/takeaway-copenhagen/",
    title: "Takeaway in Copenhagen",
    metaDescription: "Fresh takeaway in Copenhagen.",
    h1: "Takeaway Copenhagen",
    sections: [{ heading: "Fresh food", text: "Prepared daily." }],
    faq: [{ question: "Open today?", answer: "Yes." }],
    schema: [{ "@type": "LocalBusiness" }],
    images: [{ url: "https://tenant.example/hero.jpg", alt: "Hero" }],
    status: "draft"
  }, tenantConfig);

  assert.deepEqual(validateContract(pageSchema, page), []);
  assert.equal(page.pageId, "tenant-a__takeaway-copenhagen");
  assert.equal(page.tenantId, "tenant-a");
  assert.equal(page.slug, "takeaway-copenhagen");
});

test("simple localSeoGenerator output", () => {
  const bundle = generateSeoBundle({
    tenantId: "tenant-a",
    domain: "https://tenant.example",
    language: "en",
    country: "US",
    publisher: "vps-static",
    pages: [
      {
        slug: "hello-world",
        title: "Hello <World>",
        metaDescription: "A simple SEO page.",
        h1: "Hello World",
        sections: [{ heading: "Intro", text: "Local output only." }],
        status: "draft"
      }
    ]
  });

  assert.equal(bundle.tenantConfig.tenantId, "tenant-a");
  assert.equal(bundle.pages.length, 1);
  assert.match(bundle.pages[0].html, /<html lang="en">/);
  assert.match(bundle.pages[0].html, /Hello &lt;World&gt;/);
  assert.match(bundle.sitemap, /https:\/\/tenant\.example\/hello-world/);
  assert.match(bundle.robots, /Sitemap: https:\/\/tenant\.example\/sitemap\.xml/);
});

test("output does not require Firebase", () => {
  const coreSource = readFileSync(resolve(seoRoot, "generator/core.js"), "utf8");
  assert.doesNotMatch(
    coreSource,
    /from\s+["']firebase|require\(["']firebase|firebase-admin|admin\.initializeApp|httpsCallable|db\.collection/i
  );

  const bundle = generateSeoBundle({
    tenantId: "tenant-no-firebase",
    domain: "https://nofirebase.example",
    language: "da",
    country: "DK",
    publisher: "vps-static",
    pages: [{ slug: "local", title: "Local", metaDescription: "Local only.", h1: "Local" }]
  });

  const output = JSON.stringify(bundle);
  assert.doesNotMatch(output, /firebase-admin|httpsCallable|db\.collection/i);
});

if (process.exitCode) {
  process.exit(process.exitCode);
}
