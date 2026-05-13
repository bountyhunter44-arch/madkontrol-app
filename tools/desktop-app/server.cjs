const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");

const PORT = 3888;
const PROJECT_ROOT = path.resolve(".");
const PUBLIC_DIR = path.join(__dirname, "public");
const CHUNKS_ROOT = path.join(PROJECT_ROOT, "tools", "code-chunks");

function send(res, status, type, data) {
  res.writeHead(status, { "Content-Type": type });
  res.end(data);
}

function sendJson(res, data) {
  send(res, 200, "application/json; charset=utf-8", JSON.stringify(data));
}

function safePath(rel) {
  const full = path.resolve(PROJECT_ROOT, rel || "");
  if (!full.startsWith(PROJECT_ROOT)) throw new Error("Ugyldig sti");
  return full;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => (body += chunk));
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch (err) {
        reject(err);
      }
    });
  });
}

function assertFileExists(abs, label) {
  if (!fs.existsSync(abs)) throw new Error(label + " findes ikke");
  if (fs.statSync(abs).isDirectory()) throw new Error(label + " er en mappe, ikke en fil");
}

function slugify(value) {
  return String(value || "chunk")
    .replace(/[^\wæøåÆØÅ-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 90);
}

function listFiles(dir = PROJECT_ROOT, list = [], base = PROJECT_ROOT) {
  for (const file of fs.readdirSync(dir)) {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);

    if (stat.isDirectory()) {
      if (["node_modules", ".git", ".venv", "code-chunks"].includes(file)) continue;
      listFiles(full, list, base);
    } else {
      const rel = path.relative(base, full).replace(/\\/g, "/");
      if (/\.(js|cjs|mjs|ts|html|css|json|md)$/i.test(rel)) list.push(rel);
    }
  }

  return list.sort();
}

// ---------- INTELLIGENT SPLITTER ----------

function detectJsBlock(line) {
  const patterns = [
    { type: "function", regex: /^\s*(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*\(/ },
    { type: "const", regex: /^\s*const\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?\(/ },
    { type: "const_function", regex: /^\s*const\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s+)?function\s*\(/ },
    { type: "let", regex: /^\s*let\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?\(/ },
    { type: "var", regex: /^\s*var\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?\(/ },
    { type: "class", regex: /^\s*class\s+([A-Za-z0-9_$]+)/ },
    { type: "exports", regex: /^\s*exports\.([A-Za-z0-9_$]+)\s*=/ },
    { type: "module_exports", regex: /^\s*module\.exports\.([A-Za-z0-9_$]+)\s*=/ },
    { type: "export_function", regex: /^\s*export\s+(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*\(/ },
    { type: "export_const", regex: /^\s*export\s+const\s+([A-Za-z0-9_$]+)\s*=/ }
  ];

  for (const item of patterns) {
    const match = line.match(item.regex);
    if (match) {
      return {
        type: item.type,
        name: match[1]
      };
    }
  }

  return null;
}

function classifyJsBlock(name, lines) {
  const joined = lines.join("\n");
  const lower = name.toLowerCase();

  if (/onCall|https\.onCall|exports\./.test(joined)) return "callable";
  if (lower.includes("sanitize") || lower.includes("normalize") || lower.includes("format")) return "helper";
  if (lower.includes("build") || lower.includes("create") || lower.includes("generate")) return "builder";
  if (lower.includes("resolve") || lower.includes("derive") || lower.includes("calculate")) return "resolver";
  if (lower.includes("load") || lower.includes("fetch") || lower.includes("get")) return "loader";
  if (lower.includes("validate") || lower.includes("assert")) return "validator";
  if (lower.includes("delete") || lower.includes("remove")) return "deleter";
  if (/module\.exports|exports\./.test(joined)) return "export";
  return "function";
}

function splitJsIntelligent(content) {
  const lines = content.split(/\r?\n/);
  const chunks = [];

  let current = [];
  let currentName = "imports-and-init";
  let currentType = "setup";
  let startLine = 1;
  let braceDepth = 0;
  let seenFirstBlock = false;

  function push(endLine) {
    if (!current.length) return;

    const codeLines = current.slice();
    const name = currentName || "chunk";
    const type = currentType || "block";

    chunks.push({
      name,
      type,
      startLine,
      endLine,
      code: codeLines.join("\n")
    });

    current = [];
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const detected = detectJsBlock(line);

    if (detected && current.length > 0 && braceDepth <= 0) {
      push(i);

      current = [];
      currentName = detected.name;
      currentType = detected.type;
      startLine = i + 1;
      seenFirstBlock = true;
    }

    if (!seenFirstBlock && current.length === 0) {
      currentName = "imports-and-init";
      currentType = "setup";
      startLine = i + 1;
    }

    if (detected && current.length === 0) {
      currentName = detected.name;
      currentType = detected.type;
      startLine = i + 1;
      seenFirstBlock = true;
    }

    current.push(line);

    const open = (line.match(/{/g) || []).length;
    const close = (line.match(/}/g) || []).length;
    braceDepth += open - close;
    if (braceDepth < 0) braceDepth = 0;
  }

  push(lines.length);

  return chunks.map(chunk => ({
    ...chunk,
    category: chunk.type === "setup" ? "setup" : classifyJsBlock(chunk.name, chunk.code.split("\n"))
  }));
}

function splitHtmlIntelligent(content) {
  const lines = content.split(/\r?\n/);
  const chunks = [];
  let current = [];
  let startLine = 1;
  let name = "html-document";

  function push(endLine) {
    if (!current.length) return;
    chunks.push({
      name,
      type: "html",
      category: "html",
      startLine,
      endLine,
      code: current.join("\n")
    });
    current = [];
  }

  const blockRegex = /^\s*<(script|style|section|main|header|footer|nav|article|template)\b/i;

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(blockRegex);

    if (match && current.length > 20) {
      push(i);
      name = "html-" + match[1].toLowerCase();
      startLine = i + 1;
    }

    current.push(lines[i]);
  }

  push(lines.length);
  return chunks;
}

function splitCssIntelligent(content) {
  const lines = content.split(/\r?\n/);
  const chunks = [];
  let current = [];
  let startLine = 1;
  let name = "css";
  let depth = 0;

  function push(endLine) {
    if (!current.length) return;
    chunks.push({
      name,
      type: "css",
      category: "css",
      startLine,
      endLine,
      code: current.join("\n")
    });
    current = [];
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (depth === 0 && line.includes("{") && current.length > 0) {
      push(i);
      name = slugify(line.trim().slice(0, 80)) || "css-block";
      startLine = i + 1;
    }

    current.push(line);
    depth += (line.match(/{/g) || []).length;
    depth -= (line.match(/}/g) || []).length;
    if (depth < 0) depth = 0;
  }

  push(lines.length);
  return chunks;
}

function splitByLines(content, linesPerChunk) {
  const lines = content.split(/\r?\n/);
  const chunks = [];

  for (let i = 0; i < lines.length; i += linesPerChunk) {
    chunks.push({
      name: `lines-${i + 1}-${Math.min(i + linesPerChunk, lines.length)}`,
      type: "lines",
      category: "lines",
      startLine: i + 1,
      endLine: Math.min(i + linesPerChunk, lines.length),
      code: lines.slice(i, i + linesPerChunk).join("\n")
    });
  }

  return chunks;
}

function splitFile(filePath, linesPerChunk = 800) {
  const abs = safePath(filePath);
  assertFileExists(abs, "Filen");

  const ext = path.extname(abs).toLowerCase();
  const content = fs.readFileSync(abs, "utf8");

  const safeName = filePath.replace(/[\\/.:]/g, "_");
  const outDir = path.join(CHUNKS_ROOT, safeName);

  fs.mkdirSync(outDir, { recursive: true });

  for (const oldFile of fs.readdirSync(outDir)) {
    if (oldFile.startsWith("chunk-") || oldFile === "manifest.json") {
      fs.rmSync(path.join(outDir, oldFile), { force: true });
    }
  }

  let chunks;

  if ([".js", ".cjs", ".mjs", ".ts"].includes(ext)) {
    chunks = splitJsIntelligent(content);
  } else if (ext === ".html") {
    chunks = splitHtmlIntelligent(content);
  } else if (ext === ".css") {
    chunks = splitCssIntelligent(content);
  } else {
    chunks = splitByLines(content, linesPerChunk);
  }

  const manifestChunks = chunks.map((chunk, index) => {
    const num = String(index + 1).padStart(3, "0");
    const baseName = `chunk-${num}-${slugify(chunk.category)}-${slugify(chunk.name)}`;
    const codeFile = `${baseName}${ext || ".txt"}`;
    const aiFile = `${baseName}.ai.txt`;

    const aiText = [
      `FILE: ${filePath}`,
      `CHUNK: ${num}/${chunks.length}`,
      `TYPE: ${chunk.type}`,
      `CATEGORY: ${chunk.category}`,
      `BLOCK: ${chunk.name}`,
      `LINES: ${chunk.startLine}-${chunk.endLine}`,
      "",
      "OPGAVE:",
      "Læs denne chunk som del af en større kodebase.",
      "Identificér afhængigheder, imports, exports, helpers og sammenhænge først.",
      "Hvis der skal rettes kode, returnér hele relevante funktioner/blokke - ikke små snippets.",
      "",
      "--- CODE START ---",
      chunk.code,
      "--- CODE END ---",
      ""
    ].join("\n");

    fs.writeFileSync(path.join(outDir, codeFile), chunk.code, "utf8");
    fs.writeFileSync(path.join(outDir, aiFile), aiText, "utf8");

    return {
      file: codeFile,
      aiFile,
      name: chunk.name,
      type: chunk.type,
      category: chunk.category,
      startLine: chunk.startLine,
      endLine: chunk.endLine
    };
  });

  const manifest = {
    originalFile: filePath,
    extension: ext,
    totalChunks: manifestChunks.length,
    outputDir: outDir,
    chunks: manifestChunks
  };

  fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");

  return manifest;
}

// ---------- JOIN / SMART MERGE ----------

function joinChunks(dir) {
  const abs = safePath(dir);
  const manifestPath = path.join(abs, "manifest.json");

  let files;

  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    files = manifest.chunks.map(chunk => chunk.file);
  } else {
    files = fs.readdirSync(abs).filter(f => f.startsWith("chunk-") && !f.endsWith(".ai.txt")).sort();
  }

  const content = files.map(f => fs.readFileSync(path.join(abs, f), "utf8")).join("\n");
  const outFile = abs + ".rebuilt.txt";
  fs.writeFileSync(outFile, content, "utf8");

  return outFile;
}

function extractCodeFromAiText(text) {
  const source = String(text || "").replace(/\r\n/g, "\n");
  const block = source.match(/```(?:javascript|js|ts|html|css|json)?\s*([\s\S]*?)```/i);
  if (block && block[1]) return block[1].trim();

  if (source.includes("--- CODE START ---") && source.includes("--- CODE END ---")) {
    return source.split("--- CODE START ---")[1].split("--- CODE END ---")[0].trim();
  }

  return source.trim();
}

function detectFunctionNameFromCode(code) {
  const patterns = [
    /^\s*(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*\(/m,
    /^\s*const\s+([A-Za-z0-9_$]+)\s*=/m,
    /^\s*let\s+([A-Za-z0-9_$]+)\s*=/m,
    /^\s*var\s+([A-Za-z0-9_$]+)\s*=/m,
    /^\s*exports\.([A-Za-z0-9_$]+)\s*=/m,
    /^\s*module\.exports\.([A-Za-z0-9_$]+)\s*=/m
  ];

  for (const pattern of patterns) {
    const match = code.match(pattern);
    if (match) return match[1];
  }

  return "";
}

function findFunctionStartIndex(source, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`(^|\\n)\\s*(?:async\\s+)?function\\s+${escaped}\\s*\\(`),
    new RegExp(`(^|\\n)\\s*const\\s+${escaped}\\s*=`),
    new RegExp(`(^|\\n)\\s*let\\s+${escaped}\\s*=`),
    new RegExp(`(^|\\n)\\s*var\\s+${escaped}\\s*=`),
    new RegExp(`(^|\\n)\\s*exports\\.${escaped}\\s*=`),
    new RegExp(`(^|\\n)\\s*module\\.exports\\.${escaped}\\s*=`)
  ];

  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (match) return match.index + (match[1] === "\n" ? 1 : 0);
  }

  return -1;
}

function findBlockEndIndex(source, startIndex) {
  const firstBrace = source.indexOf("{", startIndex);
  if (firstBrace === -1) {
    const nextBlank = source.indexOf("\n\n", startIndex);
    return nextBlank === -1 ? source.length : nextBlank;
  }

  let depth = 0;
  let quote = null;
  let escape = false;
  let lineComment = false;
  let blockComment = false;

  for (let i = firstBrace; i < source.length; i++) {
    const ch = source[i];
    const next = source[i + 1];

    if (lineComment) {
      if (ch === "\n") lineComment = false;
      continue;
    }

    if (blockComment) {
      if (ch === "*" && next === "/") {
        blockComment = false;
        i++;
      }
      continue;
    }

    if (quote) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }

    if (ch === "/" && next === "/") {
      lineComment = true;
      i++;
      continue;
    }

    if (ch === "/" && next === "*") {
      blockComment = true;
      i++;
      continue;
    }

    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      continue;
    }

    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) {
        let end = i + 1;
        while (source[end] === ";" || source[end] === "\n" || source[end] === "\r") {
          if (source[end] === "\n") {
            end++;
            break;
          }
          end++;
        }
        return end;
      }
    }
  }

  return -1;
}

function smartMergeFunction({ targetPath, functionName, replacementText, dryRun }) {
  const abs = safePath(targetPath);
  assertFileExists(abs, "Target fil");

  const source = fs.readFileSync(abs, "utf8").replace(/\r\n/g, "\n");
  const replacementCode = extractCodeFromAiText(replacementText);
  const resolvedName = functionName || detectFunctionNameFromCode(replacementCode);

  if (!resolvedName) throw new Error("Kunne ikke finde funktionsnavn.");
  if (!replacementCode) throw new Error("Replacement er tom.");

  const start = findFunctionStartIndex(source, resolvedName);
  if (start === -1) throw new Error("Funktionen blev ikke fundet i target fil: " + resolvedName);

  const end = findBlockEndIndex(source, start);
  if (end === -1 || end <= start) throw new Error("Kunne ikke finde slutningen på funktionen: " + resolvedName);

  const oldBlock = source.slice(start, end);
  const nextContent = source.slice(0, start) + replacementCode.trim() + "\n" + source.slice(end).replace(/^\n+/, "");
  const backupPath = abs + ".backup-" + new Date().toISOString().replace(/[:.]/g, "-");

  if (!dryRun) {
    fs.writeFileSync(backupPath, source, "utf8");
    fs.writeFileSync(abs, nextContent, "utf8");
  }

  return {
    ok: true,
    dryRun: !!dryRun,
    targetPath,
    functionName: resolvedName,
    oldLength: oldBlock.length,
    newLength: replacementCode.length,
    backupPath: dryRun ? null : backupPath,
    preview: {
      oldStart: oldBlock.slice(0, 500),
      newStart: replacementCode.slice(0, 500)
    }
  };
}

function serveStatic(res, pathname) {
  const file = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const filePath = path.join(PUBLIC_DIR, file);

  if (!fs.existsSync(filePath)) return send(res, 404, "text/plain", "Not found");

  const ext = path.extname(filePath);
  const types = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8"
  };

  return send(res, 200, types[ext] || "text/plain", fs.readFileSync(filePath));
}

// ---------- SERVER ----------

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);

  try {
    if (req.method === "GET" && parsed.pathname === "/api/files") {
      return sendJson(res, { files: listFiles() });
    }

    if (req.method === "GET" && parsed.pathname === "/api/find-function") {
      const name = parsed.query.name;
      if (!name) throw new Error("Mangler navn");

      const results = [];

      for (const file of listFiles()) {
        if (!/\.(js|cjs|mjs|ts)$/i.test(file)) continue;
        const content = fs.readFileSync(safePath(file), "utf8");

        const regex = new RegExp(
          `(^|\\n)\\s*(?:function\\s+${name}\\s*\\(|const\\s+${name}\\s*=|let\\s+${name}\\s*=|var\\s+${name}\\s*=|exports\\.${name}\\s*=|module\\.exports\\.${name}\\s*=)`,
          "m"
        );

        if (regex.test(content)) {
          const line = content.slice(0, content.search(regex)).split("\n").length;
          results.push({ file, line });
        }
      }

      return sendJson(res, { results });
    }

    if (req.method === "GET" && parsed.pathname === "/api/read") {
      const abs = safePath(parsed.query.path);
      assertFileExists(abs, "Filen");
      return sendJson(res, { content: fs.readFileSync(abs, "utf8") });
    }

    if (req.method === "POST" && parsed.pathname === "/api/write") {
      const body = await readBody(req);
      fs.writeFileSync(safePath(body.path), body.content || "", "utf8");
      return sendJson(res, { ok: true });
    }

    if (req.method === "POST" && parsed.pathname === "/api/split") {
      const body = await readBody(req);
      return sendJson(res, splitFile(body.path, Number(body.linesPerChunk || 800)));
    }

    if (req.method === "POST" && parsed.pathname === "/api/join") {
      const body = await readBody(req);
      return sendJson(res, { out: joinChunks(body.dir) });
    }

    if (req.method === "POST" && parsed.pathname === "/api/merge-write") {
      const body = await readBody(req);
      fs.writeFileSync(safePath(body.path), body.content || "", "utf8");
      return sendJson(res, { ok: true, path: body.path });
    }

    if (req.method === "POST" && parsed.pathname === "/api/smart-merge") {
      const body = await readBody(req);
      return sendJson(res, smartMergeFunction({
        targetPath: body.targetPath,
        functionName: body.functionName || "",
        replacementText: body.replacementText || "",
        dryRun: !!body.dryRun
      }));
    }

    if (req.method === "GET" && parsed.pathname === "/api/chunks") {
      if (!fs.existsSync(CHUNKS_ROOT)) return sendJson(res, { dirs: [] });

      const dirs = fs.readdirSync(CHUNKS_ROOT)
        .filter(name => fs.statSync(path.join(CHUNKS_ROOT, name)).isDirectory());

      return sendJson(res, { dirs });
    }

    if (req.method === "GET" && parsed.pathname === "/api/chunk-files") {
      const abs = safePath("tools/code-chunks/" + parsed.query.dir);

      if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) {
        throw new Error("Chunk mappe findes ikke: " + parsed.query.dir);
      }

      const files = fs.readdirSync(abs).filter(f => f.endsWith(".ai.txt")).sort();
      return sendJson(res, { files });
    }

    if (req.method === "GET" && parsed.pathname === "/api/chunk-read") {
      const abs = safePath(parsed.query.file);
      assertFileExists(abs, "Chunk");
      return sendJson(res, { content: fs.readFileSync(abs, "utf8") });
    }

    return serveStatic(res, parsed.pathname);
  } catch (err) {
    return send(res, 500, "application/json; charset=utf-8", JSON.stringify({ error: err.message }));
  }
});

server.listen(PORT, () => {
  console.log("🚀 http://localhost:" + PORT);
});