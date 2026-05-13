#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const STAMP = "@madkontrollen-registry-stamp";

const CRITICAL_ROOTS = [
  "public/core",
  "public/modules/egenkontrol",
  "functions"
];

const REQUIRED_STAMP_FILES = [
  "public/modules/egenkontrol/rutiner.html",
  "public/modules/egenkontrol/rapporter.html",
  "public/core/prettyName.js",
  "public/core/layout.js",
  "functions/index.js",
  "functions/js/canonicalRoutines.js",
  "functions/canonicalTaskEngine.js"
];

const SKIP_DIRS = new Set([
  ".git",
  ".firebase",
  "node_modules",
  "lib",
  "dist",
  "coverage"
]);

const SCAN_EXTENSIONS = new Set([
  ".js",
  ".mjs",
  ".cjs",
  ".html"
]);

function toPosix(filePath) {
  return filePath.split(path.sep).join("/");
}

function rel(filePath) {
  return toPosix(path.relative(ROOT, filePath));
}

function exists(filePath) {
  return fs.existsSync(path.join(ROOT, filePath));
}

function walk(dirPath, files = []) {
  if (!fs.existsSync(dirPath)) return files;

  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) {
        walk(path.join(dirPath, entry.name), files);
      }
      continue;
    }

    const ext = path.extname(entry.name).toLowerCase();
    if (SCAN_EXTENSIONS.has(ext)) {
      files.push(path.join(dirPath, entry.name));
    }
  }

  return files;
}

function extractStampBlock(content) {
  const index = content.indexOf(STAMP);
  if (index === -1) return "";

  const blockStart = Math.max(
    content.lastIndexOf("/**", index),
    content.lastIndexOf("<!--", index)
  );

  const start = blockStart === -1 ? index : blockStart;
  const jsEnd = content.indexOf("*/", index);
  const htmlEnd = content.indexOf("-->", index);
  const candidates = [jsEnd, htmlEnd].filter((value) => value !== -1);
  const end = candidates.length ? Math.min(...candidates) : index + 2000;

  return content.slice(start, end + 3);
}

function extractQuotedValue(block, key) {
  const match = block.match(new RegExp(`${key}:\\s*"([^"]+)"`));
  return match ? match[1].trim() : "";
}

function extractList(block, key) {
  const lines = block.split(/\r?\n/);
  const start = lines.findIndex((line) => new RegExp(`\\b${key}:\\s*$`).test(line.trim()));
  if (start === -1) return [];

  const values = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const cleaned = lines[i].replace(/^\s*(\*|<!--)?\s*/, "").trim();
    if (/^[A-Za-z][A-Za-z0-9_-]*:\s*/.test(cleaned)) break;
    const item = cleaned.match(/^-\s+(.+)$/);
    if (item) values.push(item[1].trim());
  }

  return values;
}

function parseFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const hasStamp = content.includes(STAMP);
  const block = hasStamp ? extractStampBlock(content) : "";

  return {
    path: rel(filePath),
    hasStamp,
    fileRole: extractQuotedValue(block, "fileRole"),
    owns: extractList(block, "owns"),
    usesHelpers: extractList(block, "usesHelpers")
  };
}

function printList(title, items) {
  console.log(`\n${title}`);
  if (!items.length) {
    console.log("  none");
    return;
  }
  items.forEach((item) => console.log(`  - ${item}`));
}

const scannedFiles = CRITICAL_ROOTS.flatMap((rootPath) => walk(path.join(ROOT, rootPath)));
const parsed = scannedFiles.map(parseFile);
const stamped = parsed.filter((item) => item.hasStamp);

const requiredMissing = REQUIRED_STAMP_FILES
  .filter((filePath) => exists(filePath))
  .filter((filePath) => !parseFile(path.join(ROOT, filePath)).hasStamp);

const requiredNotFound = REQUIRED_STAMP_FILES.filter((filePath) => !exists(filePath));

const unstampedInCriticalRoots = parsed
  .filter((item) => !item.hasStamp)
  .map((item) => item.path);

const roleMap = new Map();
for (const item of stamped) {
  if (!item.fileRole) continue;
  if (!roleMap.has(item.fileRole)) roleMap.set(item.fileRole, []);
  roleMap.get(item.fileRole).push(item.path);
}

const duplicateRoles = Array.from(roleMap.entries())
  .filter(([, paths]) => paths.length > 1)
  .map(([role, paths]) => `${role}: ${paths.join(", ")}`);

const missingOwnership = stamped
  .filter((item) => item.owns.length === 0)
  .map((item) => item.path);

const missingHelperReferences = stamped
  .filter((item) => item.usesHelpers.length === 0)
  .map((item) => item.path);

console.log("Madkontrollen registry stamp scan");
console.log(`Root: ${ROOT}`);
console.log(`Scanned files: ${parsed.length}`);
console.log(`Stamped files: ${stamped.length}`);

printList("Missing stamp (required files)", requiredMissing);
printList("Required files not found", requiredNotFound);
printList("Duplicate role", duplicateRoles);
printList("Missing ownership", missingOwnership);
printList("Missing helper references", missingHelperReferences);

console.log("\nUnstamped files in scanned critical roots (future candidates)");
console.log(`  count: ${unstampedInCriticalRoots.length}`);
unstampedInCriticalRoots.slice(0, 25).forEach((filePath) => console.log(`  - ${filePath}`));
if (unstampedInCriticalRoots.length > 25) {
  console.log(`  ... ${unstampedInCriticalRoots.length - 25} more`);
}

const blockingIssueCount = requiredMissing.length
  + requiredNotFound.length
  + duplicateRoles.length
  + missingOwnership.length
  + missingHelperReferences.length;

if (blockingIssueCount > 0) {
  process.exitCode = 1;
}
