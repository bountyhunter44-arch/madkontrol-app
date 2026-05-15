import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { generateRobots } from "../publisher/robots.js";

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

test("robots.txt output", () => {
  const robots = generateRobots({ domain: "https://tenant.example" });

  assert.match(robots, /^User-agent: \*/);
  assert.match(robots, /Allow: \//);
  assert.match(robots, /Sitemap: https:\/\/tenant\.example\/sitemap\.xml/);
});

test("canonical URL handling", () => {
  const robots = generateRobots({ domain: "https://tenant.example/" });
  assert.match(robots, /Sitemap: https:\/\/tenant\.example\/sitemap\.xml/);
  assert.doesNotMatch(robots, /tenant\.example\/\/sitemap/);
});

test("custom sitemap URL and rules", () => {
  const robots = generateRobots({
    userAgent: "MadCoreBot",
    allow: ["/", "/public"],
    disallow: ["/admin"],
    sitemapUrl: "https://cdn.example/sitemap.xml"
  });

  assert.match(robots, /User-agent: MadCoreBot/);
  assert.match(robots, /Allow: \/public/);
  assert.match(robots, /Disallow: \/admin/);
  assert.match(robots, /Sitemap: https:\/\/cdn\.example\/sitemap\.xml/);
});

test("empty domain fallback", () => {
  const robots = generateRobots({});
  assert.match(robots, /User-agent: \*/);
  assert.match(robots, /Allow: \//);
  assert.doesNotMatch(robots, /Sitemap:/);
});

test("no Firebase dependency", () => {
  const source = readFileSync(resolve("tools/seo/publisher/robots.js"), "utf8");
  assert.doesNotMatch(
    source,
    /from\s+["']firebase|require\(["']firebase|firebase-admin|admin\.initializeApp|httpsCallable|db\.collection/i
  );
});

if (process.exitCode) {
  process.exit(process.exitCode);
}
