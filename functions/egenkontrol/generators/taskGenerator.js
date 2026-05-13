function createDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shouldGenerateForDate(template, date = new Date()) {
  const frequency = template.frequency;

  if (frequency === "daily") return true;
  if (frequency === "weekly") return date.getDay() === 1;
  if (frequency === "monthly") return date.getDate() === 1;
  if (frequency === "as_needed") return false; // Manual creation only

  return false;
}

function buildTaskInstanceId(template, dateKey) {
  return `task_${template.controlKey}__${template.scope}__${template.targetKey}__${dateKey}`;
}

function buildTaskTitle(template) {
  return `${template.targetLabel} · ${template.controlKey}`;
}

function generateTaskInstances(templates = [], date = new Date()) {
  const dateKey = createDateKey(date);

  return templates
    .filter((template) => shouldGenerateForDate(template, date))
    .map((template) => ({
      taskInstanceId: buildTaskInstanceId(template, dateKey),
      templateId: template.templateId,
      controlKey: template.controlKey,
      guideKey: template.guideKey,
      controlType: template.controlType,
      scope: template.scope,
      targetKey: template.targetKey,
      title: buildTaskTitle(template),
      dateKey,
      frequency: template.frequency,
      taskType: template.taskType,
      evidence: template.evidence || null,
      measurementConfig: template.measurementConfig || null,
      defaultMeasurementValue: template.measurementConfig?.prefillOnCreate
        ? template.measurementConfig.defaultValue
        : null,
      limits: template.limits || null,
      checkpoints: template.checkpoints || [],
      checklist: template.checklist || [],
      status: "pending"
    }));
}

module.exports = {
  createDateKey,
  shouldGenerateForDate,
  generateTaskInstances
};
