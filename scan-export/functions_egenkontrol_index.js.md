# FILE: functions/egenkontrol/index.js

```javascript
const { buildTemplatesFromProfile, buildEffectiveProfile } = require("./builders/templateBuilder");
const { generateTaskInstances } = require("./generators/taskGenerator");
const { getGuideByKey } = require("./libraries/guideLibrary");

module.exports = {
  buildEffectiveProfile,
  buildTemplatesFromProfile,
  generateTaskInstances,
  getGuideByKey
};

```
