const { execSync } = require("child_process");

const scripts = [
  "importCompanies.js",
  "importUnits.js",
  "importLocations.js",
  "importAreas.js",
  "importUsers.js",
  "importMemberships.js",
  "importActivityProfiles.js",

  "importRequirementTemplates.js",
  "importRiskTemplates.js",
  "importControlPointTemplates.js",

  "generateCompanySetup.js",
  "generateRiskProfile.js",
  "importTasks.js",
  "importTaskEntries.js",
  "generateDailyTasks.js",
  "importAlerts.js"
];

console.log("Starter seed...");

for (const script of scripts) {
  console.log(`Kører ${script}`);
  execSync(`node ${script}`, { stdio: "inherit" });
}

console.log("Seed færdig ✅");