const {
  allowedRunStatuses,
  requiredFields,
  validateIsoTimestamp,
} = require('./common');

const validateExperimentRun = (payload) => {
  const errors = [];
  errors.push(
    ...requiredFields(
      payload,
      ['id', 'planId', 'runNumber', 'status', 'startedByUserId', 'startedAt'],
      'ExperimentRun',
    ),
  );
  errors.push(...validateIsoTimestamp(payload.startedAt, 'ExperimentRun.startedAt'));
  errors.push(...validateIsoTimestamp(payload.finishedAt, 'ExperimentRun.finishedAt'));
  if (payload.status && !allowedRunStatuses.has(payload.status)) {
    errors.push('ExperimentRun.status must be running, completed, or failed');
  }
  return errors;
};

module.exports = { validateExperimentRun };
