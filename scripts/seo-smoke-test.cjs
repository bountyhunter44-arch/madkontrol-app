const https = require("https");

const domain = String(process.argv[2] || "det-gyldne-krus.madkontrollen.dk").replace(/^https?:\/\//, "").replace(/\/.*$/, "");
const baseUrl = `https://${domain}`;

function request(pathname, method = "GET") {
  return new Promise((resolve, reject) => {
    const req = https.request(`${baseUrl}${pathname}`, { method, rejectUnauthorized: false }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.setTimeout(15000, () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    req.end();
  });
}

function assert(name, ok, detail = "") {
  if (!ok) {
    throw new Error(`${name} failed${detail ? `: ${detail}` : ""}`);
  }
  console.log(`[seo-smoke] ${name} ok${detail ? `: ${detail}` : ""}`);
}

async function main() {
  const head = await request("/", "HEAD");
  assert("index status", head.status === 200, `status=${head.status}`);
  assert("server header", Boolean(head.headers.server), `server=${head.headers.server || ""}`);

  const html = await request("/?nocache=1");
  assert("html status", html.status === 200, `status=${html.status}`);
  assert("canonical href", /<link[^>]+rel=["']canonical["'][^>]+href=["'][^"']+["']/i.test(html.body));
  assert("cta/action href", /class=["'][^"']*action[^"']*["'][^>]+href=["'][^"']+["']/i.test(html.body) || /Bestil|Besøg/i.test(html.body));

  const robots = await request("/robots.txt", "HEAD");
  assert("robots status", robots.status === 200, `status=${robots.status}`);

  const sitemap = await request("/sitemap.xml", "HEAD");
  assert("sitemap status", sitemap.status === 200, `status=${sitemap.status}`);
}

main().catch((error) => {
  console.error(`[seo-smoke] failed: ${error.message}`);
  process.exitCode = 1;
});
