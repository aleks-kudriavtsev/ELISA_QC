const { requiredFields, validateIsoTimestamp } = require('./common');

const validateUser = (payload) => {
  const errors = [];
  errors.push(
    ...requiredFields(payload, ['id', 'email', 'displayName', 'role', 'createdAt'], 'User'),
  );
  errors.push(...validateIsoTimestamp(payload.createdAt, 'User.createdAt'));
  return errors;
};

module.exports = { validateUser };
