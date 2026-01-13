const { allowedStepStatuses } = require('../validation/common');

const formatStepLogMessage = ({ stepId, stepName, status, timestamp, details }) => {
  const detailEntries = details ? Object.entries(details) : [];
  const detailMessage = detailEntries.map(([key, value]) => `${key}=${value}`).join(' ');
  return [
    `step=${stepId}`,
    `name=${stepName}`,
    `status=${status}`,
    `timestamp=${timestamp}`,
    detailMessage,
  ]
    .filter(Boolean)
    .join(' ');
};

const logStep = ({ stepId, stepName, status, timestamp, details = {} }, logger = console) => {
  if (!allowedStepStatuses.has(status)) {
    throw new Error(`Unsupported step status: ${status}`);
  }

  const message = formatStepLogMessage({ stepId, stepName, status, timestamp, details });
  if (typeof logger.info === 'function') {
    logger.info(message, { stepId, stepName, status, timestamp, details });
  } else {
    logger.log(message);
  }

  return message;
};

module.exports = {
  formatStepLogMessage,
  logStep,
};
