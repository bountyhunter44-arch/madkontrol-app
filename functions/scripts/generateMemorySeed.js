"use strict";

const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const MEMORY_DIR = path.join(PROJECT_ROOT, "memory");
const OUTPUT_FILE = path.join(MEMORY_DIR, "seed.generated.json");

const INCLUDED_EXTENSIONS = new Set([
  ".js",
  ".mjs",
  ".cjs",
  ".json",
  ".html",
  ".css",
  ".ts"
]);

const EXCLUDED_DIRS = new Set([
  "node_modules",
  ".git",
  ".firebase",
  ".vscode",
  "dist",
  "build",
  "coverage",
  "memory"
]);

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function toPosix(relPath) {
  return relPath.split(path.sep).join("/");
}

function readTextSafe(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (error) {
    return "";
  }
}

function walk(dirPath, results = []) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      walk(fullPath, results);
      continue;
    }

    const ext = path.extname(entry.name).toLowerCase();
    if (!INCLUDED_EXTENSIONS.has(ext)) continue;

    results.push(fullPath);
  }

  return results;
}

function guessModule(relPath) {
  const p = relPath.toLowerCase();

  if (p.includes("cooling")) return "cooling";
  if (p.includes("onboarding")) return "onboarding";
  if (p.includes("provision")) return "onboarding";
  if (p.includes("stripe")) return "billing";
  if (p.includes("schedule")) return "scheduler";
  if (p.includes("startday")) return "scheduler";
  if (p.includes("deviation") || p.includes("afvig")) return "deviations";
  if (p.includes("rutiner")) return "rutiner";
  if (p.includes("dashboard")) return "dashboard";
  if (p.includes("report")) return "reports";
  if (p.includes("firebase")) return "firebase";
  if (p.includes("functions/index")) return "backend";

  return "general";
}

function extractImports(content) {
  const imports = [];
  const regexes = [
    /import\s+[\s\S]*?\s+from\s+['"]([^'"]+)['"]/g,
    /require\(\s*['"]([^'"]+)['"]\s*\)/g
  ];

  for (const regex of regexes) {
    let match;
    while ((match = regex.exec(content)) !== null) {
      imports.push(match[1]);
    }
  }

  return [...new Set(imports)].sort();
}

function extractExports(content) {
  const found = new Set();

  const patterns = [
    /exports\.(\w+)\s*=/g,
    /module\.exports\s*=\s*\{([\s\S]*?)\}/g,
    /export\s+function\s+(\w+)/g,
    /export\s+async\s+function\s+(\w+)/g,
    /export\s+const\s+(\w+)/g
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      if (pattern.source.startsWith("module\\.exports")) {
        const block = match[1] || "";
        const names = block
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .map((s) => s.split(":")[0].trim());
        for (const name of names) {
          if (name) found.add(name);
        }
      } else if (match[1]) {
        found.add(match[1]);
      }
    }
  }

  return [...found].sort();
}

function extractFunctions(content) {
  const functions = new Map();

  const addFn = (name, type) => {
    if (!name) return;
    if (!functions.has(name)) {
      functions.set(name, {
        name,
        type,
        called_by: [],
        calls: [],
        selectors: [],
        collections: []
      });
    }
  };

  const patterns = [
    { regex: /async function\s+([A-Za-z0-9_]+)\s*\(/g, type: "function" },
    { regex: /function\s+([A-Za-z0-9_]+)\s*\(/g, type: "function" },
    { regex: /const\s+([A-Za-z0-9_]+)\s*=\s*async\s*\(/g, type: "const_async" },
    { regex: /const\s+([A-Za-z0-9_]+)\s*=\s*\(/g, type: "const_function" }
  ];

  for (const { regex, type } of patterns) {
    let match;
    while ((match = regex.exec(content)) !== null) {
      addFn(match[1], type);
    }
  }

  const functionNames = [...functions.keys()];
  for (const fnName of functionNames) {
    const callRegex = new RegExp(`\\b${fnName}\\s*\\(`, "g");
    let count = 0;
    let match;
    while ((match = callRegex.exec(content)) !== null) {
      count += 1;
    }

    if (functions.has(fnName)) {
      functions.get(fnName).approx_occurrences = count;
    }
  }

  for (const [fnName, meta] of functions.entries()) {
    const bodyWindow = extractFunctionWindow(content, fnName);
    if (!bodyWindow) continue;

    meta.selectors = extractSelectors(bodyWindow);
    meta.collections = extractCollections(bodyWindow);
    meta.calls = functionNames
      .filter((other) => other !== fnName && new RegExp(`\\b${other}\\s*\\(`).test(bodyWindow))
      .sort();
  }

  return [...functions.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function extractFunctionWindow(content, fnName) {
  const patterns = [
    new RegExp(`async function\\s+${fnName}\\s*\\(`),
    new RegExp(`function\\s+${fnName}\\s*\\(`),
    new RegExp(`const\\s+${fnName}\\s*=\\s*async\\s*\\(`),
    new RegExp(`const\\s+${fnName}\\s*=\\s*\\(`)
  ];

  let startIndex = -1;
  for (const pattern of patterns) {
    const match = pattern.exec(content);
    if (match) {
      startIndex = match.index;
      break;
    }
  }

  if (startIndex === -1) return "";

  return content.slice(startIndex, Math.min(content.length, startIndex + 4000));
}

function extractSelectors(content) {
  const found = new Set();

  const regexes = [
    /querySelector\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
    /querySelectorAll\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
    /closest\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
    /matches\(\s*['"`]([^'"`]+)['"`]\s*\)/g
  ];

  for (const regex of regexes) {
    let match;
    while ((match = regex.exec(content)) !== null) {
      found.add(match[1]);
    }
  }

  return [...found].sort();
}

function extractCollections(content) {
  const found = new Set();

  const regexes = [
    /collection\(\s*db\s*,\s*['"`]([^'"`]+)['"`]/g,
    /doc\(\s*db\s*,\s*['"`]([^'"`]+)['"`]/g,
    /db\.collection\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
    /['"`](task_templates|task_instances|verification_instances|daily_runs|deviations|alerts|companies|equipment|areas|onboarding_answers|haccp_snapshots|live_user_profiles|media_assets|operating_overrides|program_sections|risks|locations)['"`]/g
  ];

  for (const regex of regexes) {
    let match;
    while ((match = regex.exec(content)) !== null) {
      found.add(match[1]);
    }
  }

  return [...found].sort();
}

function detectFlags(content) {
  const flags = [];

  if (content.includes("cooling_add_run")) flags.push("cooling_add_run");
  if (content.includes("cooling_run_finish")) flags.push("cooling_run_finish");
  if (content.includes("ok_sitti")) flags.push("ok_sitti");
  if (content.includes("saveRoutineTask")) flags.push("saveRoutineTask");
  if (content.includes("startDayForLocation")) flags.push("startDayForLocation");
  if (content.includes("completeTaskEntryWithCooling")) flags.push("completeTaskEntryWithCooling");
  if (content.includes(".cooling-runs-list")) flags.push("cooling_runs_list_selector");

  return flags.sort();
}

function detectRisks(relPath, content) {
  const risks = [];
  const p = relPath.toLowerCase();

  if (content.includes("if (!list) return;") && content.includes(".cooling-runs-list")) {
    risks.push("silent_return_if_cooling_container_missing");
  }

  if (content.includes('instanceStatus: "pending"') && p.includes("cooling")) {
    risks.push("cooling_failure_may_be_saved_as_pending");
  }

  if (content.includes("showIf") && content.includes("placeholder")) {
    risks.push("conditional_ui_placeholder_may_hide_real_controls");
  }

  if (content.includes("alerts") && !content.includes("deviations")) {
    risks.push("alerts_without_deviation_creation");
  }

  if (content.includes("handleAbort") && content.includes("deleteRun")) {
    risks.push("abort_may_only_clear_state");
  }

  return risks;
}

function buildFileEntry(fullPath) {
  const relPath = toPosix(path.relative(PROJECT_ROOT, fullPath));
  const content = readTextSafe(fullPath);
  const moduleName = guessModule(relPath);

  return {
    file: relPath,
    module: moduleName,
    size_bytes: Buffer.byteLength(content, "utf8"),
    imports: extractImports(content),
    exports: extractExports(content),
    functions: extractFunctions(content),
    selectors: extractSelectors(content),
    collections: extractCollections(content),
    flags: detectFlags(content),
    risks: detectRisks(relPath, content)
  };
}

function summarizeModules(fileEntries) {
  const modules = new Map();

  for (const entry of fileEntries) {
    if (!modules.has(entry.module)) {
      modules.set(entry.module, {
        name: entry.module,
        files: [],
        total_functions: 0,
        flags: new Set(),
        collections: new Set(),
        risks: new Set()
      });
    }

    const moduleRef = modules.get(entry.module);
    moduleRef.files.push(entry.file);
    moduleRef.total_functions += entry.functions.length;

    for (const flag of entry.flags) moduleRef.flags.add(flag);
    for (const col of entry.collections) moduleRef.collections.add(col);
    for (const risk of entry.risks) moduleRef.risks.add(risk);
  }

  return [...modules.values()]
    .map((m) => ({
      name: m.name,
      files: m.files.sort(),
      total_functions: m.total_functions,
      flags: [...m.flags].sort(),
      collections: [...m.collections].sort(),
      risks: [...m.risks].sort()
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function buildSeed() {
  const files = walk(PROJECT_ROOT);
  const fileEntries = files.map(buildFileEntry);

  const allCollections = new Set();
  const allFlags = new Set();
  const allRisks = new Set();

  for (const entry of fileEntries) {
    for (const c of entry.collections) allCollections.add(c);
    for (const f of entry.flags) allFlags.add(f);
    for (const r of entry.risks) allRisks.add(r);
  }

  return {
    project: "madkontrol-app",
    generatedAt: new Date().toISOString(),
    project_root: PROJECT_ROOT,
    output_file: toPosix(path.relative(PROJECT_ROOT, OUTPUT_FILE)),
    stats: {
      total_files_scanned: fileEntries.length,
      total_modules: new Set(fileEntries.map((f) => f.module)).size,
      total_functions: fileEntries.reduce((sum, file) => sum + file.functions.length, 0)
    },
    modules: summarizeModules(fileEntries),
    global_index: {
      collections: [...allCollections].sort(),
      flags: [...allFlags].sort(),
      risks: [...allRisks].sort()
    },
    files: fileEntries
  };
}

function main() {
  ensureDir(MEMORY_DIR);

  const seed = buildSeed();
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(seed, null, 2), "utf8");

  console.log("OK: memory seed generated");
  console.log(`File: ${OUTPUT_FILE}`);
  console.log(`Files scanned: ${seed.stats.total_files_scanned}`);
  console.log(`Functions found: ${seed.stats.total_functions}`);
}

main();