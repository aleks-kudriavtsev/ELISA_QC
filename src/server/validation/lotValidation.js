const allowedLotMaterialTypes = new Set(['reagent', 'antibody', 'buffer']);

const validateLotEntries = (lots, fieldName) => {
  if (lots === undefined || lots === null) {
    return [];
  }
  if (!Array.isArray(lots)) {
    return [`${fieldName} must be an array`];
  }

  const errors = [];
  lots.forEach((lot, index) => {
    if (!lot || typeof lot !== 'object') {
      errors.push(`${fieldName}[${index}] must be an object`);
      return;
    }
    const missingFields = ['id', 'materialType', 'lotNumber'].filter(
      (field) => lot[field] === undefined || lot[field] === null || lot[field] === '',
    );
    if (missingFields.length > 0) {
      errors.push(
        `${fieldName}[${index}] missing required fields: ${missingFields.join(', ')}`,
      );
    }
    if (lot.materialType && !allowedLotMaterialTypes.has(lot.materialType)) {
      errors.push(
        `${fieldName}[${index}].materialType must be reagent, antibody, or buffer`,
      );
    }
  });

  return errors;
};

module.exports = { allowedLotMaterialTypes, validateLotEntries };
