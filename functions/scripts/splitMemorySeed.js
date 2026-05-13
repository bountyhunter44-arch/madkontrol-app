"use strict";

const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const MEMORY_DIR = path.join(PROJECT_ROOT, "memory");
const INPUT_FILE = path.join(MEMORY_DIR, "seed.generated.json");

const DIRS = {
  functions: path.join(MEMORY_DIR, "functions"),
  ui: path.join(MEMORY_DIR, "ui"),
  data: path.join(MEMORY_DIR, "data"),
  modules: path.join(MEMORY_DIR, "modules"),
  risks: path.join(MEMORY_DIR, "risks")
};

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function ensureAllDirs() {
  ensureDir(MEMORY_DIR);
  Object.values(DIRS).forEach(ensureDir);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
}

function sanitizeName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function toPosix(filePath) {
  return filePath.split(path.sep).join("/");
}

function uniqueSorted(values) {
  return [...new Set((values || []).filter(Boolean))].sort();
}

function buildFunctionFiles(seed) {
  const outputFiles = [];

  for (const fileEntry of seed.files || []) {
    if (!Array.isArray(fileEntry.functions) || fileEntry.functions.length === 0) continue;

    const baseName = sanitizeName(fileEntry.file.replace(/\.[^.]+$/, ""));
    const outPath = path.join(DIRS.functions, `${baseName}.json`);

    const payload = {
      source_file: fileEntry.file,
      module: fileEntry.module,
      imports: uniqueSorted(fileEntry.imports),
      exports: uniqueSorted(fileEntry.exports),
      collections: uniqueSorted(fileEntry.collections),
      flags: uniqueSorted(fileEntry.flags),
      risks: uniqueSorted(fileEntry.risks),
      functions: fileEntry.functions.map((fn) => ({
        name: fn.name,
        type: fn.type || "",
        approx_occurrences: fn.approx_occurrences || 0,
        calls: uniqueSorted(fn.calls),
        selectors: uniqueSorted(fn.selectors),
        collections: uniqueSorted(fn.collections)
      }))
    };

    writeJson(outPath, payload);
    outputFiles.push(toPosix(path.relative(MEMORY_DIR, outPath)));
  }

  return outputFiles.sort();
}

function buildUiFiles(seed) {
  const selectorMap = new Map();

  for (const fileEntry of seed.files || []) {
    const selectors = uniqueSorted(fileEntry.selectors);
    if (selectors.length === 0) continue;

    const moduleName = sanitizeName(fileEntry.module || "general");
    if (!selectorMap.has(moduleName)) {
      selectorMap.set(moduleName, []);
    }

    selectorMap.get(moduleName).push({
      source_file: fileEntry.file,
      selectors
    });
  }

  const outputFiles = [];

  for (const [moduleName, items] of selectorMap.entries()) {
    const outPath = path.join(DIRS.ui, `${moduleName}.selectors.json`);
    writeJson(outPath, {
      module: moduleName,
      files: items
    });
    outputFiles.push(toPosix(path.relative(MEMORY_DIR, outPath)));
  }

  return outputFiles.sort();
}

function buildDataFiles(seed) {
  const collectionsByModule = new Map();

  for (const fileEntry of seed.files || []) {
    const collections = uniqueSorted(fileEntry.collections);
    if (collections.length === 0) continue;

    const moduleName = sanitizeName(fileEntry.module || "general");
    if (!collectionsByModule.has(moduleName)) {
      collectionsByModule.set(moduleName, []);
    }

    collectionsByModule.get(moduleName).push({
      source_file: fileEntry.file,
      collections
    });
  }

  const outputFiles = [];

  const globalDataPath = path.join(DIRS.data, "global-index.json");
  writeJson(globalDataPath, {
    project: seed.project,
    generatedAt: seed.generatedAt,
    collections: uniqueSorted(seed.global_index?.collections),
    flags: uniqueSorted(seed.global_index?.flags),
    risks: uniqueSorted(seed.global_index?.risks)
  });
  outputFiles.push(toPosix(path.relative(MEMORY_DIR, globalDataPath)));

  for (const [moduleName, items] of collectionsByModule.entries()) {
    const outPath = path.join(DIRS.data, `${moduleName}.collections.json`);
    writeJson(outPath, {
      module: moduleName,
      files: items
    });
    outputFiles.push(toPosix(path.relative(MEMORY_DIR, outPath)));
  }

  return outputFiles.sort();
}

function buildModuleFiles(seed) {
  const outputFiles = [];

  for (const moduleEntry of seed.modules || []) {
    const moduleName = sanitizeName(moduleEntry.name || "general");
    const outPath = path.join(DIRS.modules, `${moduleName}.json`);

    writeJson(outPath, {
      name: moduleEntry.name,
      files: uniqueSorted(moduleEntry.files),
      total_functions: moduleEntry.total_functions || 0,
      flags: uniqueSorted(moduleEntry.flags),
      collections: uniqueSorted(moduleEntry.collections),
      risks: uniqueSorted(moduleEntry.risks)
    });

    outputFiles.push(toPosix(path.relative(MEMORY_DIR, outPath)));
  }

  return outputFiles.sort();
}

function buildRiskFiles(seed) {
  const riskMap = new Map();

  for (const fileEntry of seed.files || []) {
    for (const risk of uniqueSorted(fileEntry.risks)) {
      if (!riskMap.has(risk)) {
        riskMap.set(risk, []);
      }

      riskMap.get(risk).push({
        source_file: fileEntry.file,
        module: fileEntry.module
      });
    }
  }

  const outputFiles = [];

  for (const [riskName, items] of riskMap.entries()) {
    const outPath = path.join(DIRS.risks, `${sanitizeName(riskName)}.json`);
    writeJson(outPath, {
      risk: riskName,
      occurrences: items.sort((a, b) => a.source_file.localeCompare(b.source_file))
    });
    outputFiles.push(toPosix(path.relative(MEMORY_DIR, outPath)));
  }

  return outputFiles.sort();
}

function buildMasterIndex(parts) {
  const outPath = path.join(MEMORY_DIR, "index.split.json");

  writeJson(outPath, {
    generatedAt: new Date().toISOString(),
    source: "memory/seed.generated.json",
    sections: {
      functions: parts.functions,
      ui: parts.ui,
      data: parts.data,
      modules: parts.modules,
      risks: parts.risks
    }
  });

  return toPosix(path.relative(MEMORY_DIR, outPath));
}

function main() {
  ensureAllDirs();

  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`Mangler inputfil: ${INPUT_FILE}`);
    console.error("Kør først: node functions\\scripts\\generateMemorySeed.js");
    process.exit(1);
  }

  const seed = readJson(INPUT_FILE);

  const parts = {
    functions: buildFunctionFiles(seed),
    ui: buildUiFiles(seed),
    data: buildDataFiles(seed),
    modules: buildModuleFiles(seed),
    risks: buildRiskFiles(seed)
  };

  const masterIndex = buildMasterIndex(parts);

  console.log("OK: memory seed split completed");
  console.log(`Input: ${INPUT_FILE}`);
  console.log(`Index: ${path.join(MEMORY_DIR, masterIndex)}`);
  console.log(`Functions files: ${parts.functions.length}`);
  console.log(`UI files: ${parts.ui.length}`);
  console.log(`Data files: ${parts.data.length}`);
  console.log(`Module files: ${parts.modules.length}`);
  console.log(`Risk files: ${parts.risks.length}`);
}

main();