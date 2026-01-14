const { requiredFields, validateIsoTimestamp } = require('./common');

const validateAuditLog = (payload) => {
  const errors = [];
  errors.push(
    ...requiredFields(
      payload,
      ['id', 'runId', 'userId', 'timestamp', 'field', 'oldValue', 'newValue'],
      'AuditLog',
    ),
  );
  errors.push(...validateIsoTimestamp(payload.timestamp, 'AuditLog.timestamp'));
  return errors;
};

module.exports = { validateAuditLog };
