const { requiredFields, validateIsoTimestamp } = require('./common');

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
  return errors;
};

module.exports = { validateExperimentPlan };
