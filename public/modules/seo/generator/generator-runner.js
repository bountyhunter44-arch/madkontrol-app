// generator-runner.js

import { generateWebsiteFiles } from "./generator-core.js";

export function runGenerator(config) {
  const result = generateWebsiteFiles(config);

  console.log("GENERATED FILES (preview/in-memory only):", result);

  saveFiles(result);

  return result;
}

// ======================
// SAVE (SIMPEL VERSION)
// ======================

function saveFiles(files) {
  if (!files || typeof files !== "object") {
    console.error("saveFiles: ugyldigt files-objekt");
    return;
  }

  const pages = files.pages && typeof files.pages === "object" ? files.pages : {};
  const paths = Object.keys(pages);

  console.log("saveFiles: preview/in-memory output only. No local files, Firestore docs, VPS upload or hosting publish is performed here.");
  console.log("Output paths:", paths.length);

  paths.forEach((path) => {
    console.log("PREVIEW OUTPUT:", path);
  });

  console.log("Sitemap:", files.sitemap || "");
  console.log("Robots:", files.robots || "");
}
