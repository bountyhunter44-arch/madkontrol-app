const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = process.argv[2];
const PORT = Number(process.argv[3] || 8787);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon"
};

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const full = path.join(ROOT, p);
  if (!full.startsWith(path.resolve(ROOT))) { res.writeHead(403); return res.end("no"); }
  fs.readFile(full, (err, buf) => {
    if (err) { res.writeHead(404); return res.end("404"); }
    res.writeHead(200, { "content-type": TYPES[path.extname(full).toLowerCase()] || "application/octet-stream" });
    res.end(buf);
  });
}).listen(PORT, () => console.log("serving " + ROOT + " on http://localhost:" + PORT));
