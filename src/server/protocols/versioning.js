const { extractProtocolSteps } = require('./protocolSteps');

const resolveProtocolVersion = (schema) =>
  schema?.properties?.schemaVersion?.default || schema?.schemaVersion;

const buildProtocolStepSnapshot = (protocolSchema) =>
  extractProtocolSteps(protocolSchema).map((step) => ({
    stepId: step.stepId,
    stepName: step.stepName,
    expectedFieldIds: step.expectedFieldIds,
  }));

const normalizeVersionHistory = (protocolSchema) => {
  const schemaVersion = resolveProtocolVersion(protocolSchema);
  const historyEntries = Array.isArray(protocolSchema?.versionHistory)
    ? protocolSchema.versionHistory
    : [];
  const normalized = historyEntries
    .map((entry) => ({
      version: entry?.version,
      releasedAt: entry?.releasedAt || null,
      summary: entry?.summary || '',
      steps: Array.isArray(entry?.steps) ? entry.steps : null,
    }))
    .filter((entry) => entry.version);

  if (normalized.length === 0 && schemaVersion) {
    return [
      {
        version: schemaVersion,
        releasedAt: null,
        summary: 'Initial protocol definition.',
        steps: buildProtocolStepSnapshot(protocolSchema),
      },
    ];
  }

  return normalized.map((entry) => {
    if (!entry.steps && entry.version === schemaVersion) {
      return {
        ...entry,
        steps: buildProtocolStepSnapshot(protocolSchema),
      };
    }
    return entry;
  });
};

const diffProtocolSnapshots = ({ fromSnapshot, toSnapshot }) => {
  const fromSteps = new Map(
    (fromSnapshot?.steps || []).map((step) => [step.stepId, step]),
  );
  const toSteps = new Map(
    (toSnapshot?.steps || []).map((step) => [step.stepId, step]),
  );

  const stepsAdded = [];
  const stepsRemoved = [];
  const stepsChanged = [];

  for (const [stepId, toStep] of toSteps.entries()) {
    if (!fromSteps.has(stepId)) {
      stepsAdded.push({
        stepId,
        stepName: toStep.stepName,
        expectedFieldIds: toStep.expectedFieldIds || [],
      });
    }
  }

  for (const [stepId, fromStep] of fromSteps.entries()) {
    if (!toSteps.has(stepId)) {
      stepsRemoved.push({
        stepId,
        stepName: fromStep.stepName,
        expectedFieldIds: fromStep.expectedFieldIds || [],
      });
    }
  }

  for (const [stepId, fromStep] of fromSteps.entries()) {
    if (!toSteps.has(stepId)) {
      continue;
    }
    const toStep = toSteps.get(stepId);
    const fromFields = new Set(fromStep.expectedFieldIds || []);
    const toFields = new Set(toStep.expectedFieldIds || []);
    const fieldsAdded = Array.from(toFields).filter((field) => !fromFields.has(field));
    const fieldsRemoved = Array.from(fromFields).filter(
      (field) => !toFields.has(field),
    );
    const stepNameChanged = fromStep.stepName !== toStep.stepName;
    if (fieldsAdded.length > 0 || fieldsRemoved.length > 0 || stepNameChanged) {
      stepsChanged.push({
        stepId,
        fromStepName: fromStep.stepName,
        toStepName: toStep.stepName,
        fieldsAdded,
        fieldsRemoved,
      });
    }
  }

  return {
    fromVersion: fromSnapshot?.version || null,
    toVersion: toSnapshot?.version || null,
    stepsAdded,
    stepsRemoved,
    stepsChanged,
  };
};

module.exports = {
  buildProtocolStepSnapshot,
  diffProtocolSnapshots,
  normalizeVersionHistory,
  resolveProtocolVersion,
};
