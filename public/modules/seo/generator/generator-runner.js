// generator-runner.js

import { generateWebsiteFiles } from "./generator-core.js";

export function runGenerator(config) {
  const result = generateWebsiteFiles(config);

  console.log("GENERATED FILES:", result);

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

  const pages = Array.isArray(files.pages) ? files.pages : [];

  console.log("Saving pages:", pages.length);

  pages.forEach((page) => {
    console.log("SAVE:", page.path);
  });

  console.log("Sitemap:", files.sitemap || "");
  console.log("Robots:", files.robots || "");
}