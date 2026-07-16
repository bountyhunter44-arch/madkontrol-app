"use strict";

const routines = require("./routines");

module.exports = {
  ...require("./reports"),
  ...require("./processes"),
  ...routines,
  routines,
  riskAnalysis: require("./risk-analysis"),
  templates: require("./templates"),
  deviations: require("./deviations")
};
