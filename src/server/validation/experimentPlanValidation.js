const { getProtocolSchema } = require('../protocols');
const { requiredFields, validateIsoTimestamp } = require('./common');
const {
  validatePlanAgainstProtocol,
  validateProtocolReference,
} = require('./protocolValidation');

const validateExperimentPlan = (payload) => {
  const errors = [];
  errors.push(
    ...requiredFields(
      payload,
      ['id', 'name', 'protocolId', 'version', 'createdByUserId', 'createdAt', 'steps'],
      'ExperimentPlan',
    ),
  );
  errors.push(...validateIsoTimestamp(payload.createdAt, 'ExperimentPlan.createdAt'));
  if (payload.steps && !Array.isArray(payload.steps)) {
    errors.push('ExperimentPlan.steps must be an array');
  }
  if (payload.protocolId) {
    const protocolSchema = getProtocolSchema(payload.protocolId);
    errors.push(
      ...validateProtocolReference(payload, protocolSchema, 'ExperimentPlan'),
    );
    if (protocolSchema) {
      errors.push(...validatePlanAgainstProtocol(payload, protocolSchema));
    }
  }
  return errors;
};

module.exports = { validateExperimentPlan };
