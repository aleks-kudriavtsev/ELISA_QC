const { validateUser } = require('./userValidation');
const { validateExperimentPlan } = require('./experimentPlanValidation');
const { validateExperimentDesign } = require('./experimentDesignValidation');
const { validateExperimentRun } = require('./experimentRunValidation');
const { validateStepLog } = require('./stepLogValidation');
const { validateAuditLog } = require('./auditLogValidation');
const { validateAttachment } = require('./attachmentValidation');
const { validateInstrumentRecord } = require('./instrumentRecordValidation');
const { validateUpload } = require('./uploadValidation');
const {
  extractProtocolSteps,
  validatePlanAgainstProtocol,
  validateProtocolReference,
  validateRunAgainstProtocol,
} = require('./protocolValidation');

module.exports = {
  validateUser,
  validateExperimentPlan,
  validateExperimentDesign,
  validateExperimentRun,
  validateStepLog,
  validateAuditLog,
  validateAttachment,
  validateInstrumentRecord,
  validateUpload,
  extractProtocolSteps,
  validatePlanAgainstProtocol,
  validateProtocolReference,
  validateRunAgainstProtocol,
};
