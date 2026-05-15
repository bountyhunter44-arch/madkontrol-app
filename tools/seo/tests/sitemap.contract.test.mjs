import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { generateSitemap } from "../publisher/sitemap.js";

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

test("sitemap XML output", () => {
  const xml = generateSitemap(
    { domain: "https://tenant.example" },
    [{ slug: "front", lastmod: "2026-05-15", changefreq: "weekly", priority: 0.8 }]
  );

  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(xml, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  assert.match(xml, /<loc>https:\/\/tenant\.example\/front<\/loc>/);
  assert.match(xml, /<lastmod>2026-05-15<\/lastmod>/);
  assert.match(xml, /<changefreq>weekly<\/changefreq>/);
  assert.match(xml, /<priority>0.8<\/priority>/);
});

test("multiple pages", () => {
  const xml = generateSitemap({
    domain: "https://tenant.example",
    pages: [
      { slug: "a" },
      { path: "landing-pages/b.html" },
      { canonicalPath: "/c/" }
    ]
  });

  assert.equal((xml.match(/<url>/g) || []).length, 3);
  assert.match(xml, /https:\/\/tenant\.example\/a/);
  assert.match(xml, /https:\/\/tenant\.example\/landing-pages\/b\.html/);
  assert.match(xml, /https:\/\/tenant\.example\/c\//);
});

test("canonical URL handling", () => {
  const xml = generateSitemap(
    { domain: "https://tenant.example/" },
    [
      { canonicalUrl: "https://canonical.example/page" },
      { url: "https://tenant-cdn.example/absolute" },
      { path: "index.html" }
    ]
  );

  assert.match(xml, /<loc>https:\/\/canonical\.example\/page<\/loc>/);
  assert.match(xml, /<loc>https:\/\/tenant-cdn\.example\/absolute<\/loc>/);
  assert.match(xml, /<loc>https:\/\/tenant\.example\/<\/loc>/);
});

test("empty pages fallback", () => {
  const xml = generateSitemap({ domain: "https://tenant.example" }, []);
  assert.match(xml, /<urlset xmlns=/);
  assert.equal((xml.match(/<url>/g) || []).length, 0);
});

test("no Firebase dependency", () => {
  const source = readFileSync(resolve("tools/seo/publisher/sitemap.js"), "utf8");
  assert.doesNotMatch(
    source,
    /from\s+["']firebase|require\(["']firebase|firebase-admin|admin\.initializeApp|httpsCallable|db\.collection/i
  );
});

if (process.exitCode) {
  process.exit(process.exitCode);
}
