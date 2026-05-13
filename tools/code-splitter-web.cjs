const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");

const PORT = 3777;
const BASE_DIR = path.resolve(".");
const OUT_ROOT = path.join(BASE_DIR, "tools", "code-chunks");

function send(res, status, type, data) {
  res.writeHead(status, { "Content-Type": type });
  res.end(data);
}

function safeRelPath(input) {
  const resolved = path.resolve(BASE_DIR, input);
  if (!resolved.startsWith(BASE_DIR)) {
    throw new Error("Ugyldig filsti udenfor projektmappen.");
  }
  return resolved;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function getAllFiles(dir, list = [], base = dir) {
  for (const file of fs.readdirSync(dir)) {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);

    if (stat.isDirectory()) {
      if (
        file === "node_modules" ||
        file === ".git" ||
        file === ".venv" ||
        file === "code-chunks" ||
        file.startsWith(".")
      ) {
        continue;
      }
      getAllFiles(full, list, base);
    } else {
      const rel = path.relative(base, full).replace(/\\/g, "/");
      if (/\.(js|cjs|mjs|html|css|json|ts)$/i.test(rel)) {
        list.push(rel);
      }
    }
  }

  return list.sort();
}

function detectJsBlockName(line) {
  const patterns = [
    /^\s*(async\s+)?function\s+([A-Za-z0-9_$]+)/,
    /^\s*const\s+([A-Za-z0-9_$]+)\s*=\s*(async\s*)?\(/,
    /^\s*const\s+([A-Za-z0-9_$]+)\s*=\s*(async\s*)?function/,
    /^\s*let\s+([A-Za-z0-9_$]+)\s*=\s*(async\s*)?\(/,
    /^\s*var\s+([A-Za-z0-9_$]+)\s*=\s*(async\s*)?\(/,
    /^\s*class\s+([A-Za-z0-9_$]+)/,
    /^\s*exports\.([A-Za-z0-9_$]+)\s*=/,
    /^\s*module\.exports\.([A-Za-z0-9_$]+)\s*=/,
    /^\s*export\s+(async\s+)?function\s+([A-Za-z0-9_$]+)/,
    /^\s*export\s+const\s+([A-Za-z0-9_$]+)\s*=/
  ];

  for (const p of patterns) {
    const m = line.match(p);
    if (m) return m[m.length - 1];
  }

  return null;
}

function splitJsSmart(lines) {
  const chunks = [];
  let current = [];
  let currentName = "top-level";
  let braceDepth = 0;
  let started = false;
  let startLine = 1;

  function push(endLine) {
    if (!current.length) return;
    chunks.push({
      name: currentName,
      startLine,
      endLine,
      lines: current
    });
    current = [];
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const blockName = detectJsBlockName(line);

    if (blockName && started && braceDepth <= 0 && current.length > 0) {
      push(i);
      startLine = i + 1;
      currentName = blockName;
    }

    if (!started) {
      started = true;
      startLine = i + 1;
      currentName = blockName || "imports-and-top-level";
    }

    if (blockName && braceDepth <= 0 && current.length === 0) {
      currentName = blockName;
      startLine = i + 1;
    }

    current.push(line);

    const open = (line.match(/{/g) || []).length;
    const close = (line.match(/}/g) || []).length;
    braceDepth += open - close;

    if (braceDepth < 0) braceDepth = 0;
  }

  push(lines.length);

  return chunks;
}

function splitHtmlSmart(lines) {
  const chunks = [];
  let current = [];
  let currentName = "html-head";
  let startLine = 1;

  const blockStart = /^\s*<(script|style|section|main|header|footer|nav|article|template)\b/i;

  function push(endLine) {
    if (!current.length) return;
    chunks.push({
      name: currentName,
      startLine,
      endLine,
      lines: current
    });
    current = [];
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(blockStart);

    if (m && current.length > 30) {
      push(i);
      currentName = `html-${m[1].toLowerCase()}`;
      startLine = i + 1;
    }

    current.push(line);
  }

  push(lines.length);
  return chunks;
}

function splitCssSmart(lines) {
  const chunks = [];
  let current = [];
  let currentName = "css-block";
  let startLine = 1;
  let depth = 0;

  function push(endLine) {
    if (!current.length) return;
    chunks.push({
      name: currentName,
      startLine,
      endLine,
      lines: current
    });
    current = [];
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (depth === 0 && line.includes("{") && current.length > 0) {
      push(i);
      currentName = line.trim().slice(0, 80) || "css-selector";
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

function splitByLines(lines, linesPerChunk) {
  const chunks = [];

  for (let i = 0; i < lines.length; i += linesPerChunk) {
    chunks.push({
      name: `lines-${i + 1}-${Math.min(i + linesPerChunk, lines.length)}`,
      startLine: i + 1,
      endLine: Math.min(i + linesPerChunk, lines.length),
      lines: lines.slice(i, i + linesPerChunk)
    });
  }

  return chunks;
}

function splitFile(inputPath, options = {}) {
  const abs = safeRelPath(inputPath);
  if (!fs.existsSync(abs)) throw new Error("Filen findes ikke.");

  const ext = path.extname(abs).toLowerCase();
  const baseName = path.basename(abs, ext);
  const safeName = inputPath.replace(/[\\/.:]/g, "_").replace(/_+/g, "_");
  const outDir = path.join(OUT_ROOT, safeName);

  ensureDir(outDir);

  const content = fs.readFileSync(abs, "utf8");
  const lines = content.split(/\r?\n/);
  const mode = options.mode || "smart";
  const linesPerChunk = Number(options.linesPerChunk || 800);

  let rawChunks;

  if (mode === "lines") {
    rawChunks = splitByLines(lines, linesPerChunk);
  } else if ([".js", ".cjs", ".mjs", ".ts"].includes(ext)) {
    rawChunks = splitJsSmart(lines);
  } else if (ext === ".html") {
    rawChunks = splitHtmlSmart(lines);
  } else if (ext === ".css") {
    rawChunks = splitCssSmart(lines);
  } else {
    rawChunks = splitByLines(lines, linesPerChunk);
  }

  const chunks = rawChunks.map((chunk, index) => {
    const num = String(index + 1).padStart(3, "0");
    const chunkFile = `chunk-${num}${ext || ".txt"}`;
    const aiFile = `chunk-${num}.ai.txt`;

    const code = chunk.lines.join("\n");

    const aiHeader = [
      `FILE: ${inputPath}`,
      `CHUNK: ${num}/${rawChunks.length}`,
      `BLOCK: ${chunk.name}`,
      `LINES: ${chunk.startLine}-${chunk.endLine}`,
      "",
      "OPGAVE:",
      "Læs denne chunk som en del af en større fil. Bevar kontekst, imports, exports, helpers og afhængigheder.",
      "Svar ikke med små snippets. Hvis der skal rettes kode, returnér hele relevante funktioner/blokke.",
      "",
      "--- CODE START ---",
      code,
      "--- CODE END ---",
      ""
    ].join("\n");

    fs.writeFileSync(path.join(outDir, chunkFile), code, "utf8");
    fs.writeFileSync(path.join(outDir, aiFile), aiHeader, "utf8");

    return {
      file: chunkFile,
      aiFile,
      block: chunk.name,
      startLine: chunk.startLine,
      endLine: chunk.endLine,
      lineCount: chunk.endLine - chunk.startLine + 1
    };
  });

  const manifest = {
    originalFile: inputPath,
    absoluteInput: abs,
    mode,
    extension: ext,
    totalLines: lines.length,
    totalChunks: chunks.length,
    outputDir: outDir,
    chunks
  };

  fs.writeFileSync(
    path.join(outDir, "manifest.json"),
    JSON.stringify(manifest, null, 2),
    "utf8"
  );

  return manifest;
}

function joinChunks(chunkDir) {
  const abs = safeRelPath(chunkDir);
  const manifestPath = path.join(abs, "manifest.json");

  if (!fs.existsSync(manifestPath)) {
    throw new Error("manifest.json mangler.");
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

  const content = manifest.chunks
    .map((c) => fs.readFileSync(path.join(abs, c.file), "utf8"))
    .join("\n");

  const outFile = `${abs}.rebuilt${manifest.extension || ".txt"}`;
  fs.writeFileSync(outFile, content, "utf8");

  return outFile;
}

const html = `<!DOCTYPE html>
<html lang="da">
<head>
<meta charset="UTF-8">
<title>Madkontrollen Code Splitter</title>
<style>
body{font-family:Arial,sans-serif;background:#0f172a;color:#e5e7eb;margin:0;padding:24px}
.wrap{max-width:1100px;margin:auto}
.card{background:#111827;border:1px solid #334155;border-radius:16px;padding:20px;margin-bottom:18px}
select,input,button{font-size:15px;padding:10px;border-radius:10px;border:1px solid #475569}
select,input{background:#020617;color:#e5e7eb;width:100%;box-sizing:border-box}
button{cursor:pointer;background:#22c55e;color:#052e16;font-weight:700}
button.secondary{background:#38bdf8;color:#082f49}
.grid{display:grid;grid-template-columns:2fr 1fr 1fr;gap:12px}
pre{background:#020617;border:1px solid #334155;padding:14px;border-radius:12px;overflow:auto;white-space:pre-wrap}
.chunk{padding:10px;border-bottom:1px solid #334155}
.small{color:#94a3b8;font-size:13px}
</style>
</head>
<body>
<div class="wrap">
<h1>Madkontrollen Code Splitter</h1>

<div class="card">
<div class="grid">
<div>
<label>Fil</label>
<select id="fileList"></select>
</div>
<div>
<label>Mode</label>
<select id="mode">
<option value="smart">Smart: funktioner/helpers/html/css</option>
<option value="lines">Linjer</option>
</select>
</div>
<div>
<label>Linjer pr chunk</label>
<input id="lines" value="800">
</div>
</div>
<br>
<button onclick="splitFile()">Split fil</button>
<button class="secondary" onclick="joinFile()">Join igen</button>
</div>

<div class="card">
<h2>Resultat</h2>
<div id="summary" class="small"></div>
<div id="chunks"></div>
<pre id="output"></pre>
</div>
</div>

<script>
async function loadFiles(){
  const res = await fetch("/files");
  const files = await res.json();
  const select = document.getElementById("fileList");
  select.innerHTML = "";
  files.forEach(f => {
    const opt = document.createElement("option");
    opt.value = f;
    opt.textContent = f;
    select.appendChild(opt);
  });
}

async function splitFile(){
  const file = document.getElementById("fileList").value;
  const mode = document.getElementById("mode").value;
  const linesPerChunk = document.getElementById("lines").value;

  const res = await fetch("/split", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({file, mode, linesPerChunk})
  });

  const data = await res.json();

  document.getElementById("summary").textContent =
    data.error ? data.error : "Chunks: " + data.totalChunks + " | Output: " + data.outputDir;

  document.getElementById("output").textContent = JSON.stringify(data, null, 2);

  const chunks = document.getElementById("chunks");
  chunks.innerHTML = "";

  if (data.chunks) {
    data.chunks.forEach(c => {
      const div = document.createElement("div");
      div.className = "chunk";
      div.innerHTML =
        "<b>" + c.file + "</b> / <b>" + c.aiFile + "</b><br>" +
        "<span class='small'>" + c.block + " | linjer " + c.startLine + "-" + c.endLine + "</span>";
      chunks.appendChild(div);
    });
  }
}

async function joinFile(){
  const file = document.getElementById("fileList").value;
  const safe = file.replace(/[\\\\/.:]/g, "_").replace(/_+/g, "_");

  const res = await fetch("/join", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({dir:"tools/code-chunks/" + safe})
  });

  const data = await res.json();
  document.getElementById("output").textContent = JSON.stringify(data, null, 2);
}

loadFiles();
</script>
</body>
</html>`;

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);

  if (req.method === "GET" && parsed.pathname === "/") {
    return send(res, 200, "text/html; charset=utf-8", html);
  }

  if (req.method === "GET" && parsed.pathname === "/files") {
    try {
      const files = getAllFiles(BASE_DIR);
      return send(res, 200, "application/json", JSON.stringify(files));
    } catch (e) {
      return send(res, 500, "application/json", JSON.stringify({ error: e.message }));
    }
  }

  if (req.method === "POST" && parsed.pathname === "/split") {
    let body = "";
    req.on("data", c => body += c);
    req.on("end", () => {
      try {
        const data = JSON.parse(body);
        const result = splitFile(data.file, {
          mode: data.mode,
          linesPerChunk: data.linesPerChunk
        });
        return send(res, 200, "application/json", JSON.stringify(result));
      } catch (e) {
        return send(res, 500, "application/json", JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  if (req.method === "POST" && parsed.pathname === "/join") {
    let body = "";
    req.on("data", c => body += c);
    req.on("end", () => {
      try {
        const data = JSON.parse(body);
        const out = joinChunks(data.dir);
        return send(res, 200, "application/json", JSON.stringify({ out }));
      } catch (e) {
        return send(res, 500, "application/json", JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  return send(res, 404, "text/plain", "Not found");
});

server.listen(PORT, () => {
  console.log("Code Splitter kører:");
  console.log(`http://localhost:${PORT}`);
});