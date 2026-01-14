const isoTimestampRegex =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

const allowedRunStatuses = new Set(['running', 'completed', 'failed']);
const allowedStepStatuses = new Set(['started', 'finished', 'failed']);

const requiredFields = (payload, fields, context) => {
  const missing = fields.filter((field) => payload[field] === undefined || payload[field] === null);
  if (missing.length > 0) {
    return [`${context} missing required fields: ${missing.join(', ')}`];
  }
  return [];
};

const validateIsoTimestamp = (value, fieldName) => {
  if (!value) {
    return [];
  }
  if (!isoTimestampRegex.test(value)) {
    return [`${fieldName} must be ISO-8601 UTC timestamp`];
  }
  return [];
};

const validateSignature = (signature, context) => {
  if (!signature) {
    return [];
  }
  if (typeof signature !== 'object') {
    return [`${context} must be an object`];
  }
  const errors = [];
  errors.push(...requiredFields(signature, ['userId', 'timestamp', 'method'], context));
  errors.push(...validateIsoTimestamp(signature.timestamp, `${context}.timestamp`));
  return errors;
};

module.exports = {
  allowedRunStatuses,
  allowedStepStatuses,
  requiredFields,
  validateIsoTimestamp,
  validateSignature,
};
