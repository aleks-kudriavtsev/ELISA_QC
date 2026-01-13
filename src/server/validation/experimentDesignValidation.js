const { requiredFields, validateIsoTimestamp } = require('./common');

const validateFactor = (factor, index) => {
  const errors = [];
  if (!factor) {
    errors.push(`ExperimentDesign.factors[${index}] is required`);
    return errors;
  }
  if (!factor.id) {
    errors.push(`ExperimentDesign.factors[${index}].id is required`);
  }
  if (!factor.name) {
    errors.push(`ExperimentDesign.factors[${index}].name is required`);
  }
  if (!Array.isArray(factor.levels) || factor.levels.length === 0) {
    errors.push(`ExperimentDesign.factors[${index}].levels must be a non-empty array`);
  }
  return errors;
};

const validateMatrixRow = (row, index, factorIds) => {
  const errors = [];
  if (!row) {
    errors.push(`ExperimentDesign.matrix[${index}] is required`);
    return errors;
  }
  if (!row.id) {
    errors.push(`ExperimentDesign.matrix[${index}].id is required`);
  }
  if (row.runNumber === undefined || row.runNumber === null) {
    errors.push(`ExperimentDesign.matrix[${index}].runNumber is required`);
  }
  if (!row.factorLevels || typeof row.factorLevels !== 'object') {
    errors.push(`ExperimentDesign.matrix[${index}].factorLevels is required`);
    return errors;
  }
  factorIds.forEach((factorId) => {
    if (!(factorId in row.factorLevels)) {
      errors.push(
        `ExperimentDesign.matrix[${index}].factorLevels missing ${factorId}`,
      );
    }
  });
  return errors;
};

const validateExperimentDesign = (payload) => {
  const errors = [];
  errors.push(
    ...requiredFields(
      payload,
      ['id', 'name', 'createdByUserId', 'createdAt', 'factors', 'matrix'],
      'ExperimentDesign',
    ),
  );
  errors.push(
    ...validateIsoTimestamp(payload.createdAt, 'ExperimentDesign.createdAt'),
  );
  if (payload.factors && !Array.isArray(payload.factors)) {
    errors.push('ExperimentDesign.factors must be an array');
  }
  if (payload.matrix && !Array.isArray(payload.matrix)) {
    errors.push('ExperimentDesign.matrix must be an array');
  }

  const factors = Array.isArray(payload.factors) ? payload.factors : [];
  factors.forEach((factor, index) => {
    errors.push(...validateFactor(factor, index));
  });

  const factorIds = factors.map((factor) => factor.id).filter(Boolean);
  const matrix = Array.isArray(payload.matrix) ? payload.matrix : [];
  matrix.forEach((row, index) => {
    errors.push(...validateMatrixRow(row, index, factorIds));
  });

  return errors;
};

module.exports = { validateExperimentDesign };
