const { allowedStepStatuses, requiredFields, validateIsoTimestamp } = require('./common');
const { validateLotEntries } = require('./lotValidation');

const validateStepLog = (payload) => {
  const errors = [];
  errors.push(
    ...requiredFields(
      payload,
      ['id', 'runId', 'stepId', 'stepName', 'status', 'timestamp', 'message'],
      'StepLog',
    ),
  );
  errors.push(...validateIsoTimestamp(payload.timestamp, 'StepLog.timestamp'));
  if (payload.status && !allowedStepStatuses.has(payload.status)) {
    errors.push('StepLog.status must be started, finished, or failed');
  }
  errors.push(...validateLotEntries(payload.lots, 'StepLog.lots'));
  return errors;
};

module.exports = { validateStepLog };
