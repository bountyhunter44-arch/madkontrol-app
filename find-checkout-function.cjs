// SLET FRA HER

const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "functions"); // justér hvis nødvendigt

const SEARCH_TERMS = [
  "createOnboardingCheckoutSession",
  "checkout.sessions.create",
  "STRIPE_SECRET_KEY",
  "onCall(",
  "https.onCall"
];

function searchInFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf8");

    SEARCH_TERMS.forEach(term => {
      if (content.includes(term)) {
        console.log(`\n📄 MATCH i: ${filePath}`);
        console.log(`🔎 Indeholder: "${term}"\n`);

        // vis lidt context
        const lines = content.split("\n");
        lines.forEach((line, index) => {
          if (line.includes(term)) {
            console.log(`Linje ${index + 1}: ${line.trim()}`);
          }
        });
      }
    });
  } catch (err) {
    console.error("Fejl ved læsning:", filePath, err.message);
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      walkDir(fullPath);
    } else if (file.endsWith(".js")) {
      searchInFile(fullPath);
    }
  });
}

console.log("🔍 Starter søgning...\n");
walkDir(ROOT_DIR);
console.log("\n✅ Færdig");

// TIL HER