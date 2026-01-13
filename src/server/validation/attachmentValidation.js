const { requiredFields, validateIsoTimestamp } = require('./common');

const validateAttachment = (payload) => {
  const errors = [];
  errors.push(
    ...requiredFields(payload, ['id', 'runId', 'type', 'path', 'label', 'createdAt'], 'Attachment'),
  );
  errors.push(...validateIsoTimestamp(payload.createdAt, 'Attachment.createdAt'));
  if (payload.path && !payload.path.startsWith('images/') && !payload.path.startsWith('csv/')) {
    errors.push('Attachment.path must start with images/ or csv/');
  }
  return errors;
};

module.exports = { validateAttachment };
