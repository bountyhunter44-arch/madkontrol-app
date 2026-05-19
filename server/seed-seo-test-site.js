import { createRequire } from "module";

const require = createRequire(import.meta.url);

if (process.env.SEO_GATEWAY_ALLOW_DEV_SEED !== "1") {
  console.error("DEV ONLY: Set SEO_GATEWAY_ALLOW_DEV_SEED=1 to seed the local SEO gateway test site.");
  process.exit(1);
}

const admin = require("firebase-admin");
const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || "../serviceAccountKey.json";
const serviceAccount = require(serviceAccountPath);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id
  });
}

const db = admin.firestore();
const now = admin.firestore.FieldValue.serverTimestamp();

const websiteId = "seo_test_herning_aroi_d";
const pageId = "seo_test_herning_aroi_d_index";

await db.collection("websites").doc(websiteId).set({
  companyId: "seo_test_company",
  organizationId: "seo_test_company",
  locationId: "seo_test_location",
  subdomain: "aroi-d",
  citySlug: "herning",
  businessSlug: "aroi-d",
  routePath: "/herning/aroi-d/",
  outputPath: "herning/aroi-d/index.html",
  status: "published",
  template: "seo-gateway-test",
  heroTitle: "Aroi-D",
  heroText: "Thai restaurant i Ørnhøj med frisk takeaway og autentiske retter.",
  heroImageUrl: "",
  phone: "20717861",
  address: "Herning",
  themePrimary: "#7f1d1d",
  themeSecondary: "#fef3c7",
  themeAccent: "#dc2626",
  themeText: "#1f2937",
  createdAt: now,
  updatedAt: now,
  source: "server/seed-seo-test-site.js"
}, { merge: true });

await db.collection("seo_pages").doc(pageId).set({
  websiteId,
  companyId: "seo_test_company",
  organizationId: "seo_test_company",
  locationId: "seo_test_location",
  citySlug: "herning",
  businessSlug: "aroi-d",
  slug: "herning/aroi-d",
  routePath: "/herning/aroi-d/",
  canonicalPath: "/herning/aroi-d/",
  outputPath: "herning/aroi-d/index.html",
  url: "https://herning.madkontrollen.dk/aroi-d/",
  status: "published",
  ordering: 1,
  keyword: "Thai restaurant i Ørnhøj",
  title: "Aroi-D | Thai restaurant i Ørnhøj",
  h1: "Thai restaurant i Ørnhøj",
  h2: "Autentisk Thai mad hos Aroi-D",
  metaDescription: "Aroi-D serverer Thai restaurant i Ørnhøj med takeaway, varme retter og autentisk smag.",
  bodyText: "Aroi-D serverer autentisk thailandsk mad i Ørnhøj og Herning-området.",
  createdAt: now,
  updatedAt: now,
  source: "server/seed-seo-test-site.js"
}, { merge: true });

console.log(JSON.stringify({
  ok: true,
  websiteId,
  pageId,
  citySlug: "herning",
  businessSlug: "aroi-d",
  routePath: "/herning/aroi-d/",
  outputPath: "herning/aroi-d/index.html"
}, null, 2));
