# FILE: functions/egenkontrol/utils/registryHelpers.js

```javascript
function unique(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function normalizeOnboardingProfile(rawProfile = {}) {
  return {
    businessType: rawProfile.businessType || null,
    areaTypes: unique(rawProfile.areaTypes || []),
    equipmentTypes: unique(rawProfile.equipmentTypes || []),
    activityTypes: unique(rawProfile.activityTypes || []),
    riskTags: unique(rawProfile.riskTags || [])
  };
}

module.exports = {
  unique,
  normalizeOnboardingProfile
};

```
