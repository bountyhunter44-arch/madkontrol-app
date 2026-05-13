const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);

function usage() {
  console.log(`
Brug:

Split fil:
node tools/code-splitter.cjs split functions/index.js --lines 800

Join igen:
node tools/code-splitter.cjs join tools/code-chunks/index
`);
  process.exit(1);
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function splitFile(inputFile, linesPerChunk) {
  const absoluteInput = path.resolve(inputFile);

  if (!fs.existsSync(absoluteInput)) {
    throw new Error(`Filen findes ikke: ${absoluteInput}`);
  }

  const ext = path.extname(absoluteInput);
  const baseName = path.basename(absoluteInput, ext);
  const outputDir = path.resolve("tools", "code-chunks", baseName);

  ensureDir(outputDir);

  const content = fs.readFileSync(absoluteInput, "utf8");
  const lines = content.split(/\r?\n/);

  const chunks = [];

  for (let i = 0; i < lines.length; i += linesPerChunk) {
    const chunkNumber = String(chunks.length + 1).padStart(3, "0");
    const chunkLines = lines.slice(i, i + linesPerChunk);
    const chunkFileName = `chunk-${chunkNumber}${ext}`;
    const chunkPath = path.join(outputDir, chunkFileName);

    fs.writeFileSync(chunkPath, chunkLines.join("\n"), "utf8");

    chunks.push({
      file: chunkFileName,
      startLine: i + 1,
      endLine: Math.min(i + linesPerChunk, lines.length)
    });
  }

  const manifest = {
    originalFile: inputFile,
    absoluteInput,
    baseName,
    extension: ext,
    linesPerChunk,
    totalLines: lines.length,
    totalChunks: chunks.length,
    chunks
  };

  fs.writeFileSync(
    path.join(outputDir, "manifest.json"),
    JSON.stringify(manifest, null, 2),
    "utf8"
  );

  console.log(`OK: Fil splittet i ${chunks.length} chunks`);
  console.log(`Mappe: ${outputDir}`);
}

function joinChunks(chunkDir) {
  const absoluteDir = path.resolve(chunkDir);
  const manifestPath = path.join(absoluteDir, "manifest.json");

  if (!fs.existsSync(manifestPath)) {
    throw new Error(`manifest.json mangler i: ${absoluteDir}`);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

  const rebuiltContent = manifest.chunks
    .map((chunk) => {
      const chunkPath = path.join(absoluteDir, chunk.file);

      if (!fs.existsSync(chunkPath)) {
        throw new Error(`Chunk mangler: ${chunkPath}`);
      }

      return fs.readFileSync(chunkPath, "utf8");
    })
    .join("\n");

  const outputFile = path.resolve(
    `${absoluteDir}.rebuilt${manifest.extension || ".txt"}`
  );

  fs.writeFileSync(outputFile, rebuiltContent, "utf8");

  console.log("OK: Chunks samlet igen");
  console.log(`Ny fil: ${outputFile}`);
}

try {
  const command = args[0];

  if (!command) usage();

  if (command === "split") {
    const inputFile = args[1];
    const linesIndex = args.indexOf("--lines");
    const linesPerChunk =
      linesIndex !== -1 ? Number(args[linesIndex + 1]) : 800;

    if (!inputFile) usage();

    if (!Number.isInteger(linesPerChunk) || linesPerChunk < 50) {
      throw new Error("--lines skal være et heltal på mindst 50");
    }

    splitFile(inputFile, linesPerChunk);
    process.exit(0);
  }

  if (command === "join") {
    const chunkDir = args[1];

    if (!chunkDir) usage();

    joinChunks(chunkDir);
    process.exit(0);
  }

  usage();
} catch (error) {
  console.error("FEJL:", error.message);
  process.exit(1);
}