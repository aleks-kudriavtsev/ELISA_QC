const { requiredFields, validateIsoTimestamp } = require('./common');

const validateInstrumentRecord = (payload) => {
  const errors = [];
  errors.push(
    ...requiredFields(
      payload,
      ['id', 'runId', 'instrumentId', 'instrumentType', 'recordedAt', 'dataPath'],
      'InstrumentRecord',
    ),
  );
  errors.push(...validateIsoTimestamp(payload.recordedAt, 'InstrumentRecord.recordedAt'));
  if (payload.dataPath && !payload.dataPath.startsWith('csv/')) {
    errors.push('InstrumentRecord.dataPath must start with csv/');
  }
  return errors;
};

module.exports = { validateInstrumentRecord };
