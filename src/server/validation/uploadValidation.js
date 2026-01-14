const { requiredFields, validateIsoTimestamp } = require('./common');

const allowedUploadKinds = new Set(['csv', 'image', 'xlsx']);

const validateUpload = (payload) => {
  const errors = [];
  errors.push(
    ...requiredFields(
      payload,
      [
        'id',
        'runId',
        'fileName',
        'contentType',
        'kind',
        'storagePath',
        'createdAt',
      ],
      'Upload',
    ),
  );
  errors.push(...validateIsoTimestamp(payload.createdAt, 'Upload.createdAt'));
  if (payload.kind && !allowedUploadKinds.has(payload.kind)) {
    errors.push('Upload.kind must be csv, xlsx, or image');
  }
  if (payload.storagePath) {
    if (payload.kind === 'image' && !payload.storagePath.startsWith('images/')) {
      errors.push('Upload.storagePath must start with images/ for image uploads');
    }
    if (
      (payload.kind === 'csv' || payload.kind === 'xlsx') &&
      !payload.storagePath.startsWith('csv/')
    ) {
      errors.push('Upload.storagePath must start with csv/ for tabular uploads');
    }
  }
  if (payload.sizeBytes !== undefined && Number.isNaN(Number(payload.sizeBytes))) {
    errors.push('Upload.sizeBytes must be a number');
  }
  return errors;
};

module.exports = { validateUpload, allowedUploadKinds };
