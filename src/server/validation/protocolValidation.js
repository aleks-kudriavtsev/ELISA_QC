const {
  getProtocolSchema,
  getProtocolVersionHistory,
} = require('../protocols');
const { extractProtocolSteps } = require('../protocols/protocolSteps');

const validateProtocolReference = (payload, protocolSchema, context) => {
  const errors = [];
  if (!payload?.protocolId) {
    errors.push(`${context}.protocolId is required for protocol validation`);
    return errors;
  }
  if (!protocolSchema) {
    errors.push(`${context}.protocolId references unknown protocol ${payload.protocolId}`);
    return errors;
  }

  const history = getProtocolVersionHistory(payload.protocolId);
  if (payload.version && history.length > 0) {
    const matchesVersion = history.some((entry) => entry.version === payload.version);
    if (!matchesVersion) {
      errors.push(
        `${context}.version must match a known protocol schema version`,
      );
    }
  }

  return errors;
};

const validatePlanAgainstProtocol = (planPayload, protocolSchema) => {
  const errors = [];
  const protocolSteps = extractProtocolSteps(protocolSchema);
  const planSteps = Array.isArray(planPayload?.steps) ? planPayload.steps : [];

  const protocolStepIds = new Set(protocolSteps.map((step) => step.stepId));
  const planStepIds = new Set(planSteps.map((step) => step.stepId));

  protocolSteps.forEach((protocolStep) => {
    if (!planStepIds.has(protocolStep.stepId)) {
      errors.push(
        `ExperimentPlan.steps missing protocol step ${protocolStep.stepId}`,
      );
    }
  });

  planSteps.forEach((planStep) => {
    if (!planStep.stepId) {
      errors.push('ExperimentPlan.steps.stepId is required');
      return;
    }
    if (!protocolStepIds.has(planStep.stepId)) {
      errors.push(
        `ExperimentPlan.steps includes unknown protocol step ${planStep.stepId}`,
      );
      return;
    }
    const protocolStep = protocolSteps.find(
      (step) => step.stepId === planStep.stepId,
    );
    const parameters = planStep.parameters || {};
    protocolStep.expectedFieldIds.forEach((fieldId) => {
      if (parameters[fieldId] === undefined || parameters[fieldId] === null) {
        errors.push(
          `ExperimentPlan.steps missing expected field ${fieldId} for step ${planStep.stepId}`,
        );
      }
    });
  });

  return errors;
};

const validateRunAgainstProtocol = (runPayload, planPayload) => {
  const errors = [];
  const protocolId = runPayload?.protocolId || planPayload?.protocolId;
  if (!protocolId) {
    return errors;
  }
  const protocolSchema = getProtocolSchema(protocolId);
  if (!protocolSchema) {
    errors.push(`ExperimentRun.protocolId references unknown protocol ${protocolId}`);
    return errors;
  }
  if (planPayload?.protocolId) {
    errors.push(
      ...validateProtocolReference(planPayload, protocolSchema, 'ExperimentPlan'),
    );
    if (protocolSchema) {
      errors.push(...validatePlanAgainstProtocol(planPayload, protocolSchema));
    }
  }
  if (!runPayload?.protocolVersion) {
    errors.push('ExperimentRun.protocolVersion is required for protocol validation');
  } else {
    const history = getProtocolVersionHistory(protocolId);
    const matchesVersion = history.some(
      (entry) => entry.version === runPayload.protocolVersion,
    );
    if (!matchesVersion) {
      errors.push('ExperimentRun.protocolVersion must reference a known protocol version');
    }
  }
  if (
    runPayload?.protocolVersion &&
    planPayload?.version &&
    runPayload.protocolVersion !== planPayload.version
  ) {
    errors.push('ExperimentRun.protocolVersion must match ExperimentPlan.version');
  }
  if (
    runPayload?.protocolId &&
    planPayload?.protocolId &&
    runPayload.protocolId !== planPayload.protocolId
  ) {
    errors.push('ExperimentRun.protocolId must match ExperimentPlan.protocolId');
  }
  if (planPayload.id && runPayload?.planId && planPayload.id !== runPayload.planId) {
    errors.push('ExperimentRun.planId must reference the selected plan');
  }
  return errors;
};

module.exports = {
  extractProtocolSteps,
  validatePlanAgainstProtocol,
  validateProtocolReference,
  validateRunAgainstProtocol,
};
