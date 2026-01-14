const {
  allowedRunStatuses,
  requiredFields,
  validateIsoTimestamp,
  validateSignature,
} = require('./common');
const { validateRunAgainstProtocol } = require('./protocolValidation');
const { validateLotEntries } = require('./lotValidation');

const validateExperimentRun = (payload, planPayload) => {
  const errors = [];
  errors.push(
    ...requiredFields(
      payload,
      [
        'id',
        'planId',
        'protocolId',
        'protocolVersion',
        'runNumber',
        'status',
        'startedByUserId',
        'startedAt',
      ],
      'ExperimentRun',
    ),
  );
  errors.push(...validateIsoTimestamp(payload.startedAt, 'ExperimentRun.startedAt'));
  errors.push(...validateIsoTimestamp(payload.finishedAt, 'ExperimentRun.finishedAt'));
  if (payload.status && !allowedRunStatuses.has(payload.status)) {
    errors.push('ExperimentRun.status must be running, completed, or failed');
  }
  if (payload.status === 'completed' && !payload.completedSignature) {
    errors.push('ExperimentRun.completedSignature is required when status is completed');
  }
  errors.push(
    ...validateSignature(
      payload.completedSignature,
      'ExperimentRun.completedSignature',
    ),
  );
  if (payload.designId && !payload.runSeriesId) {
    errors.push('ExperimentRun.runSeriesId is required when designId is provided');
  }
  if (payload.designId && !payload.designRowId) {
    errors.push('ExperimentRun.designRowId is required when designId is provided');
  }
  errors.push(...validateLotEntries(payload.lots, 'ExperimentRun.lots'));
  if (planPayload) {
    errors.push(...validateRunAgainstProtocol(payload, planPayload));
  }
  return errors;
};

module.exports = { validateExperimentRun };
