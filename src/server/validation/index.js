const { validateUser } = require('./userValidation');
const { validateExperimentPlan } = require('./experimentPlanValidation');
const { validateExperimentRun } = require('./experimentRunValidation');
const { validateStepLog } = require('./stepLogValidation');
const { validateAttachment } = require('./attachmentValidation');
const { validateInstrumentRecord } = require('./instrumentRecordValidation');

module.exports = {
  validateUser,
  validateExperimentPlan,
  validateExperimentRun,
  validateStepLog,
  validateAttachment,
  validateInstrumentRecord,
};
