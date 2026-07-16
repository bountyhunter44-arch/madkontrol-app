from pathlib import Path
from datetime import datetime

p = Path("functions/index.js")
text = p.read_text(encoding="utf-8")
stamp = datetime.now().strftime("%Y%m%d%H%M%S")
backup = p.with_name(f"index.js.bak-quick-selected-modules-{stamp}")
backup.write_text(text, encoding="utf-8")

old_parse = '''  const industry = String(payload.industry || "restaurant").trim();
  const profile = payload.profile || {};
'''

new_parse = '''  const industry = String(payload.industry || "restaurant").trim();
  const profile = payload.profile || {};

  const allowedQuickModules = new Set(["egenkontrol", "pos", "lagerkontrol", "menu", "seo"]);
  const selectedModules = Array.isArray(payload.selectedModules)
    ? payload.selectedModules
        .map((moduleSlug) => String(moduleSlug || "").trim().toLowerCase())
        .filter((moduleSlug) => allowedQuickModules.has(moduleSlug))
    : [];

  if (!selectedModules.includes("egenkontrol")) {
    selectedModules.unshift("egenkontrol");
  }

  const enabledModules = Array.from(new Set(selectedModules));
  const moduleAccess = enabledModules.reduce((acc, moduleSlug) => {
    acc[moduleSlug] = {
      enabled: true,
      status: "trial",
      source: "quick-onboarding",
      activatedAt: FieldValue.serverTimestamp()
    };
    return acc;
  }, {});
'''

if old_parse not in text:
    raise SystemExit("Kunne ikke finde parse-blokken efter industry/profile. Stopper.")
text = text.replace(old_parse, new_parse, 1)

old_log = '''    industry
  });
'''

new_log = '''    industry,
    selectedModules: enabledModules
  });
'''

if old_log not in text:
    raise SystemExit("Kunne ikke finde parsed console.log-blokken. Stopper.")
text = text.replace(old_log, new_log, 1)

old_company = '''      subscriptionStatus: "trial",
      isPaid: false,
      trialStartedAt: FieldValue.serverTimestamp(),
'''

new_company = '''      subscriptionStatus: "trial",
      isPaid: false,
      selectedModules: enabledModules,
      enabledModules: enabledModules,
      activeModules: enabledModules,
      moduleAccess: moduleAccess,
      modules: moduleAccess,
      trialStartedAt: FieldValue.serverTimestamp(),
'''

if old_company not in text:
    raise SystemExit("Kunne ikke finde company subscription-blokken. Stopper.")
text = text.replace(old_company, new_company, 1)

old_user = '''      subscriptionStatus: "trial",
      createdAt: FieldValue.serverTimestamp(),
'''

new_user = '''      subscriptionStatus: "trial",
      selectedModules: enabledModules,
      enabledModules: enabledModules,
      activeModules: enabledModules,
      moduleAccess: moduleAccess,
      modules: moduleAccess,
      createdAt: FieldValue.serverTimestamp(),
'''

if old_user not in text:
    raise SystemExit("Kunne ikke finde user subscription-blokken. Stopper.")
text = text.replace(old_user, new_user, 1)

old_profile = '''      subscriptionStatus: "trial",
      isPaid: false,
      createdAt: FieldValue.serverTimestamp(),
'''

new_profile = '''      subscriptionStatus: "trial",
      isPaid: false,
      selectedModules: enabledModules,
      enabledModules: enabledModules,
      activeModules: enabledModules,
      moduleAccess: moduleAccess,
      modules: moduleAccess,
      createdAt: FieldValue.serverTimestamp(),
'''

if old_profile not in text:
    raise SystemExit("Kunne ikke finde live_user_profiles subscription-blokken. Stopper.")
text = text.replace(old_profile, new_profile, 1)

old_return = '''      organizationId: organizationId,
      ...(onboardingResult || {})
'''

new_return = '''      organizationId: organizationId,
      selectedModules: enabledModules,
      enabledModules: enabledModules,
      ...(onboardingResult || {})
'''

if old_return not in text:
    raise SystemExit("Kunne ikke finde return-blokken. Stopper.")
text = text.replace(old_return, new_return, 1)

p.write_text(text, encoding="utf-8")
print(f"Backup: {backup}")
print("OK: createQuickOnboardingAccount now stores selectedModules/moduleAccess")
