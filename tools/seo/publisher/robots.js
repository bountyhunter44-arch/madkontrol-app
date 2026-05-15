import { buildCanonicalUrl, normalizeDomain } from "./sitemap.js";

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function trimString(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function generateRobots(configOrDomain = {}) {
  const config = typeof configOrDomain === "string" ? { domain: configOrDomain } : configOrDomain;
  const domain = normalizeDomain(config);
  const userAgent = trimString(config.userAgent, "*");
  const allow = toArray(config.allow?.length ? config.allow : ["/"]);
  const disallow = toArray(config.disallow);
  const sitemapUrl = trimString(config.sitemapUrl) || (domain ? buildCanonicalUrl(domain, "sitemap.xml") : "");

  const lines = [
    `User-agent: ${userAgent}`,
    ...allow.map((path) => `Allow: ${trimString(path, "/")}`),
    ...disallow.map((path) => `Disallow: ${trimString(path, "/")}`)
  ];

  if (sitemapUrl) {
    lines.push("", `Sitemap: ${sitemapUrl}`);
  }

  return `${lines.join("\n")}\n`;
}

export { generateRobots };
