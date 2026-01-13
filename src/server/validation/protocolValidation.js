const { getProtocolSchema } = require('../protocols');

const extractExpectedFieldIds = (expectedFieldsSchema) => {
  const constraints = expectedFieldsSchema?.allOf || [];
  return constraints
    .map((constraint) => constraint?.contains?.properties?.fieldId?.const)
    .filter(Boolean);
};

const extractProtocolSteps = (protocolSchema) => {
  const stepSchemas = protocolSchema?.properties?.steps?.prefixItems || [];
  return stepSchemas
    .map((stepSchema) => {
      const stepId =
        stepSchema?.properties?.id?.const || stepSchema?.properties?.id?.default;
      const stepName =
        stepSchema?.properties?.name?.const || stepSchema?.properties?.name?.default;
      return {
        stepId,
        stepName,
        expectedFieldIds: extractExpectedFieldIds(
          stepSchema?.properties?.expectedFields,
        ),
      };
    })
    .filter((step) => step.stepId);
};

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

  const schemaVersion = protocolSchema?.properties?.schemaVersion?.default;
  if (payload.version && schemaVersion && payload.version !== schemaVersion) {
    errors.push(
      `${context}.version must match protocol schema version ${schemaVersion}`,
    );
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
  if (!planPayload?.protocolId) {
    return [];
  }
  const protocolSchema = getProtocolSchema(planPayload.protocolId);
  const errors = [];
  errors.push(
    ...validateProtocolReference(planPayload, protocolSchema, 'ExperimentPlan'),
  );
  if (protocolSchema) {
    errors.push(...validatePlanAgainstProtocol(planPayload, protocolSchema));
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
